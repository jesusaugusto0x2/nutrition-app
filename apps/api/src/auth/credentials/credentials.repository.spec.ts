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

  describe('findByEmailForUpdate', () => {
    it('finds the user inside the transaction', async () => {
      const user = await insertUser(connection.db, {
        email: 'locked@example.com',
      });

      await expect(
        connection.db.transaction((tx) =>
          repository.findByEmailForUpdate('locked@example.com', tx),
        ),
      ).resolves.toMatchObject({ id: user.id });
    });

    it('finds nothing for an unknown email', async () => {
      await expect(
        connection.db.transaction((tx) =>
          repository.findByEmailForUpdate('unknown@example.com', tx),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('createVerified', () => {
    const verifiedAt = new Date('2026-11-01T12:00:00.000Z');

    it('creates a verified user without a password', async () => {
      const { id } = await connection.db.transaction((tx) =>
        repository.createVerified(
          {
            email: 'created-by-google@example.com',
            name: 'Ana',
            emailVerifiedAt: verifiedAt,
          },
          tx,
        ),
      );

      await expect(
        repository.findByEmail('created-by-google@example.com'),
      ).resolves.toEqual({
        id,
        email: 'created-by-google@example.com',
        name: 'Ana',
        passwordHash: null,
        emailVerifiedAt: verifiedAt,
      });
    });

    it('fails instead of reusing a taken email', async () => {
      const existing = await insertUser(connection.db, {
        email: 'race@example.com',
        name: 'Original',
      });

      await expect(
        connection.db.transaction((tx) =>
          repository.createVerified(
            {
              email: 'race@example.com',
              name: 'Second',
              emailVerifiedAt: verifiedAt,
            },
            tx,
          ),
        ),
      ).rejects.toThrow();

      await expect(
        repository.findByEmail('race@example.com'),
      ).resolves.toMatchObject({ id: existing.id, name: 'Original' });
    });
  });

  describe('takeOverUnverified', () => {
    const now = new Date('2026-11-01T12:00:00.000Z');

    it('removes the password, ends the sessions and verifies the email', async () => {
      const user = await insertUser(connection.db, {
        email: 'pre-registered@example.com',
        passwordHash: 'attacker-hash',
      });
      await insertSession(connection.db, user.id);

      await connection.db.transaction((tx) =>
        repository.takeOverUnverified(user.id, now, tx),
      );

      await expect(
        repository.findByEmail('pre-registered@example.com'),
      ).resolves.toMatchObject({ passwordHash: null, emailVerifiedAt: now });
      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.userId, user.id)),
      ).resolves.toEqual([]);
    });

    it('leaves other users alone', async () => {
      const user = await insertUser(connection.db);
      const other = await insertUser(connection.db, {
        passwordHash: 'other-hash',
      });
      await insertSession(connection.db, other.id);

      await connection.db.transaction((tx) =>
        repository.takeOverUnverified(user.id, now, tx),
      );

      await expect(repository.findByEmail(other.email)).resolves.toMatchObject({
        passwordHash: 'other-hash',
        emailVerifiedAt: null,
      });
      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.userId, other.id)),
      ).resolves.toHaveLength(1);
    });
  });

  describe('createUnverified', () => {
    const newUser = {
      email: 'new@example.com',
      name: 'Ana',
      passwordHash: 'stored-hash',
    };

    it('creates a user whose email is not verified', async () => {
      const created = await repository.createUnverified(newUser);

      expect(created).toEqual({
        id: expect.any(String),
        email: 'new@example.com',
        name: 'Ana',
      });
      await expect(repository.findByEmail('new@example.com')).resolves.toEqual({
        ...newUser,
        id: created?.id,
        emailVerifiedAt: null,
      });
    });

    it('changes nothing when the email already has an account', async () => {
      const existing = await insertUser(connection.db, {
        email: 'taken@example.com',
        name: 'Original',
        passwordHash: 'original-hash',
      });

      await expect(
        repository.createUnverified({ ...newUser, email: 'taken@example.com' }),
      ).resolves.toBeUndefined();

      await expect(
        repository.findByEmail('taken@example.com'),
      ).resolves.toMatchObject({
        id: existing.id,
        name: 'Original',
        passwordHash: 'original-hash',
      });
    });

    it('writes through the transaction it receives', async () => {
      await expect(
        connection.db.transaction(async (tx) => {
          await repository.createUnverified(
            { ...newUser, email: 'rolled-back@example.com' },
            tx,
          );
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');

      await expect(
        repository.findByEmail('rolled-back@example.com'),
      ).resolves.toBeUndefined();
    });
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

  describe('verifyEmail', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const verifiedAt = new Date('2026-01-01T00:00:00.000Z');

    function verifiedAtOf(id: string) {
      return connection.db
        .select({ emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, id))
        .then(([row]) => row.emailVerifiedAt);
    }

    it('verifies the email and consumes the token', async () => {
      const user = await insertUser(connection.db, {
        email: 'verify@example.com',
        name: 'Verify',
      });
      const token = await insertAuthToken(connection.db, user.id, {
        purpose: 'email_verification',
        expiresAt: new Date('2026-01-10T01:00:00.000Z'),
      });

      await expect(
        repository.verifyEmail({ tokenHash: token.tokenHash, now }),
      ).resolves.toEqual({
        id: user.id,
        email: 'verify@example.com',
        name: 'Verify',
        emailVerifiedAt: now,
      });

      await expect(verifiedAtOf(user.id)).resolves.toEqual(now);
      const [row] = await connection.db
        .select({ usedAt: authTokens.usedAt })
        .from(authTokens)
        .where(eq(authTokens.id, token.id));
      expect(row.usedAt).toEqual(now);
    });

    it('accepts a token only once', async () => {
      const user = await insertUser(connection.db);
      const { tokenHash } = await insertAuthToken(connection.db, user.id, {
        purpose: 'email_verification',
      });

      await expect(
        repository.verifyEmail({ tokenHash, now }),
      ).resolves.toBeDefined();
      await expect(
        repository.verifyEmail({ tokenHash, now }),
      ).resolves.toBeUndefined();
    });

    it('does not accept a token for an email that is already verified', async () => {
      const user = await insertUser(connection.db, {
        emailVerifiedAt: verifiedAt,
      });
      const { tokenHash } = await insertAuthToken(connection.db, user.id, {
        purpose: 'email_verification',
      });

      await expect(
        repository.verifyEmail({ tokenHash, now }),
      ).resolves.toBeUndefined();

      await expect(verifiedAtOf(user.id)).resolves.toEqual(verifiedAt);
    });

    it.each([
      {
        case: 'an expired token',
        token: { purpose: 'email_verification' as const, expiresAt: now },
      },
      {
        case: 'a used token',
        token: { purpose: 'email_verification' as const, usedAt: verifiedAt },
      },
      {
        case: 'a password reset token',
        token: { purpose: 'password_reset' as const },
      },
    ])('changes nothing for $case', async ({ token }) => {
      const user = await insertUser(connection.db);
      const { tokenHash } = await insertAuthToken(
        connection.db,
        user.id,
        token,
      );

      await expect(
        repository.verifyEmail({ tokenHash, now }),
      ).resolves.toBeUndefined();

      await expect(verifiedAtOf(user.id)).resolves.toBeNull();
    });

    it('changes nothing for an unknown token', async () => {
      await expect(
        repository.verifyEmail({ tokenHash: 'hash-unknown', now }),
      ).resolves.toBeUndefined();
    });

    it("verifies only the token owner's email", async () => {
      const user = await insertUser(connection.db);
      const other = await insertUser(connection.db);
      const { tokenHash } = await insertAuthToken(connection.db, user.id, {
        purpose: 'email_verification',
      });

      await repository.verifyEmail({ tokenHash, now });

      await expect(verifiedAtOf(other.id)).resolves.toBeNull();
    });
  });
});
