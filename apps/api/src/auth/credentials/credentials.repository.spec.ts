import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { authTokens, sessions, users } from '../../database/schema';
import {
  insertAuthToken,
  insertSession,
  insertUser,
} from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { CredentialsRepository } from './credentials.repository';

describe('CredentialsRepository', () => {
  let connection: DatabaseConnection;
  let repository: CredentialsRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new CredentialsRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('finds a user and their password hash by email', async () => {
    const user = await insertUser(connection.db, {
      email: 'ana@example.com',
      passwordHash: 'stored-hash',
    });

    await expect(repository.findByEmail('ana@example.com')).resolves.toEqual({
      id: user.id,
      email: 'ana@example.com',
      name: user.name,
      emailVerifiedAt: null,
      passwordHash: 'stored-hash',
    });
  });

  it('returns a null hash for a user without a password', async () => {
    await insertUser(connection.db, { email: 'google@example.com' });

    const row = await repository.findByEmail('google@example.com');

    expect(row?.passwordHash).toBeNull();
  });

  it('does not find an unknown email', async () => {
    await expect(
      repository.findByEmail('nobody@example.com'),
    ).resolves.toBeUndefined();
  });

  it("replaces only that user's password hash", async () => {
    const user = await insertUser(connection.db, { passwordHash: 'old' });
    const other = await insertUser(connection.db, { passwordHash: 'other' });

    await repository.updatePasswordHash(user.id, 'new');

    const hashOf = async (id: string) =>
      (
        await connection.db
          .select({ passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, id))
      )[0].passwordHash;
    await expect(hashOf(user.id)).resolves.toBe('new');
    await expect(hashOf(other.id)).resolves.toBe('other');
  });

  describe('resetPassword', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const verifiedAt = new Date('2026-01-01T00:00:00.000Z');

    function userById(id: string) {
      return connection.db
        .select({
          passwordHash: users.passwordHash,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .then(([row]) => row);
    }

    function sessionCount(userId: string) {
      return connection.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .then((rows) => rows.length);
    }

    it('stores the hash, verifies the email, consumes the token and ends every session', async () => {
      const user = await insertUser(connection.db, {
        email: 'reset@example.com',
        name: 'Reset',
        passwordHash: 'old',
      });
      await insertSession(connection.db, user.id);
      await insertSession(connection.db, user.id);
      const token = await insertAuthToken(connection.db, user.id, {
        tokenHash: 'hash-reset',
        expiresAt: new Date('2026-01-10T01:00:00.000Z'),
      });

      await expect(
        repository.resetPassword({
          tokenHash: 'hash-reset',
          passwordHash: 'new',
          now,
        }),
      ).resolves.toEqual({
        id: user.id,
        email: 'reset@example.com',
        name: 'Reset',
      });

      await expect(userById(user.id)).resolves.toEqual({
        passwordHash: 'new',
        emailVerifiedAt: now,
      });
      await expect(sessionCount(user.id)).resolves.toBe(0);
      const [row] = await connection.db
        .select({ usedAt: authTokens.usedAt })
        .from(authTokens)
        .where(eq(authTokens.id, token.id));
      expect(row.usedAt).toEqual(now);
    });

    it('keeps an earlier verification date', async () => {
      const user = await insertUser(connection.db, {
        emailVerifiedAt: verifiedAt,
      });
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'hash-verified-user',
      });

      await repository.resetPassword({
        tokenHash: 'hash-verified-user',
        passwordHash: 'new',
        now,
      });

      await expect(userById(user.id)).resolves.toMatchObject({
        emailVerifiedAt: verifiedAt,
      });
    });

    it('sets a first password for a Google-only user', async () => {
      const user = await insertUser(connection.db);
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'hash-google-only',
      });

      await repository.resetPassword({
        tokenHash: 'hash-google-only',
        passwordHash: 'first',
        now,
      });

      await expect(userById(user.id)).resolves.toMatchObject({
        passwordHash: 'first',
      });
    });

    it('accepts a token only once', async () => {
      const user = await insertUser(connection.db);
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'hash-once',
      });
      const reset = { tokenHash: 'hash-once', passwordHash: 'new', now };

      await expect(repository.resetPassword(reset)).resolves.toBeDefined();
      await expect(
        repository.resetPassword({ ...reset, passwordHash: 'again' }),
      ).resolves.toBeUndefined();
      await expect(userById(user.id)).resolves.toMatchObject({
        passwordHash: 'new',
      });
    });

    it.each([
      { case: 'an expired token', token: { expiresAt: now } },
      { case: 'a used token', token: { usedAt: verifiedAt } },
      {
        case: 'an email verification token',
        token: { purpose: 'email_verification' as const },
      },
    ])('changes nothing for $case', async ({ token }) => {
      const user = await insertUser(connection.db, { passwordHash: 'old' });
      await insertSession(connection.db, user.id);
      const { tokenHash } = await insertAuthToken(
        connection.db,
        user.id,
        token,
      );

      await expect(
        repository.resetPassword({ tokenHash, passwordHash: 'new', now }),
      ).resolves.toBeUndefined();

      await expect(userById(user.id)).resolves.toEqual({
        passwordHash: 'old',
        emailVerifiedAt: null,
      });
      await expect(sessionCount(user.id)).resolves.toBe(1);
    });

    it('changes nothing for an unknown token', async () => {
      await expect(
        repository.resetPassword({
          tokenHash: 'hash-unknown',
          passwordHash: 'new',
          now,
        }),
      ).resolves.toBeUndefined();
    });

    it("ends only the reset user's sessions", async () => {
      const user = await insertUser(connection.db);
      const other = await insertUser(connection.db);
      await insertSession(connection.db, other.id);
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'hash-isolated',
      });

      await repository.resetPassword({
        tokenHash: 'hash-isolated',
        passwordHash: 'new',
        now,
      });

      await expect(sessionCount(other.id)).resolves.toBe(1);
    });
  });
});
