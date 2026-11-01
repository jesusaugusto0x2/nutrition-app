import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { authTokens } from '../../database/schema';
import { insertAuthToken, insertUser } from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { AuthTokensRepository } from './auth-tokens.repository';

const expiresAt = new Date('2026-01-10T01:00:00.000Z');

describe('AuthTokensRepository', () => {
  let connection: DatabaseConnection;
  let repository: AuthTokensRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new AuthTokensRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  function tokensOf(userId: string) {
    return connection.db
      .select({
        purpose: authTokens.purpose,
        tokenHash: authTokens.tokenHash,
      })
      .from(authTokens)
      .where(eq(authTokens.userId, userId));
  }

  it('stores a token by its hash', async () => {
    const user = await insertUser(connection.db);

    await repository.replace({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: 'hash-new',
      expiresAt,
    });

    await expect(tokensOf(user.id)).resolves.toEqual([
      { purpose: 'password_reset', tokenHash: 'hash-new' },
    ]);
  });

  it("replaces the user's earlier tokens of the same purpose only", async () => {
    const user = await insertUser(connection.db);
    const other = await insertUser(connection.db);
    await insertAuthToken(connection.db, user.id, { tokenHash: 'hash-old' });
    await insertAuthToken(connection.db, user.id, {
      tokenHash: 'hash-verification',
      purpose: 'email_verification',
    });
    await insertAuthToken(connection.db, other.id, {
      tokenHash: 'hash-other-user',
    });

    await repository.replace({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: 'hash-latest',
      expiresAt,
    });

    const remaining = await tokensOf(user.id);
    expect(remaining).toHaveLength(2);
    expect(remaining).toEqual(
      expect.arrayContaining([
        { purpose: 'password_reset', tokenHash: 'hash-latest' },
        { purpose: 'email_verification', tokenHash: 'hash-verification' },
      ]),
    );
    await expect(tokensOf(other.id)).resolves.toEqual([
      { purpose: 'password_reset', tokenHash: 'hash-other-user' },
    ]);
  });

  describe('deleteExpiredOrUsed', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const future = new Date('2026-01-10T00:00:00.001Z');

    beforeEach(async () => {
      await connection.db.delete(authTokens);
    });

    it('deletes expired and used tokens and keeps usable ones', async () => {
      const user = await insertUser(connection.db);
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'expired',
        expiresAt: new Date('2026-01-09T00:00:00.000Z'),
      });
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'expires-now',
        expiresAt: now,
      });
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'used',
        expiresAt: future,
        usedAt: new Date('2026-01-09T00:00:00.000Z'),
      });
      await insertAuthToken(connection.db, user.id, {
        tokenHash: 'usable',
        purpose: 'email_verification',
        expiresAt: future,
      });

      await expect(repository.deleteExpiredOrUsed(now)).resolves.toBe(3);

      await expect(tokensOf(user.id)).resolves.toEqual([
        { purpose: 'email_verification', tokenHash: 'usable' },
      ]);
    });

    it('deletes nothing on a second run', async () => {
      const user = await insertUser(connection.db);
      await insertAuthToken(connection.db, user.id, { expiresAt: now });

      await expect(repository.deleteExpiredOrUsed(now)).resolves.toBe(1);
      await expect(repository.deleteExpiredOrUsed(now)).resolves.toBe(0);
    });
  });
});
