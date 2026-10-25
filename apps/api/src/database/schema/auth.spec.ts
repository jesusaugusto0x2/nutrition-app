import { normalizeEmail } from '@nutri/schemas';
import type { DatabaseConnection } from '../client';
import { createTestDatabase } from '../testing/test-database';
import { insertUser } from '../testing/fixtures';
import { authAccounts, authTokens, sessions, users } from './index';

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000);

// Drizzle wraps the driver error; the violated constraint is on its cause.
async function violatedConstraint(query: Promise<unknown>) {
  const error: unknown = await query.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  return (error as { cause?: { constraint?: string } } | undefined)?.cause
    ?.constraint;
}

describe('auth schema', () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = await createTestDatabase();
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('users', () => {
    it.each(['Owner@example.com', ' owner@example.com', 'owner@example.com '])(
      'rejects the unnormalized email %j',
      async (email) => {
        await expect(
          violatedConstraint(
            connection.db.insert(users).values({ email, name: 'Owner' }),
          ),
        ).resolves.toBe('users_email_normalized_check');
      },
    );

    it('rejects the same email in a different letter case', async () => {
      await insertUser(connection.db, {
        email: normalizeEmail('Case@example.com'),
      });

      await expect(
        violatedConstraint(
          connection.db
            .insert(users)
            .values({ email: normalizeEmail('CASE@Example.com'), name: 'X' }),
        ),
      ).resolves.toBe('users_email_unique');
    });

    it('allows a user without a password or a verified email', async () => {
      const user = await insertUser(connection.db);

      expect(user.passwordHash).toBeNull();
      expect(user.emailVerifiedAt).toBeNull();
    });
  });

  describe('sessions', () => {
    it('rejects a duplicate token hash', async () => {
      const user = await insertUser(connection.db);
      const session = {
        userId: user.id,
        tokenHash: 'session-hash',
        expiresAt: inOneHour(),
      };
      await connection.db.insert(sessions).values(session);

      await expect(
        violatedConstraint(connection.db.insert(sessions).values(session)),
      ).resolves.toBe('sessions_token_hash_unique');
    });
  });

  describe('auth_accounts', () => {
    it('links a provider account to only one user', async () => {
      const userA = await insertUser(connection.db);
      const userB = await insertUser(connection.db);
      const account = {
        provider: 'google',
        providerAccountId: 'sub-1',
      } as const;
      await connection.db
        .insert(authAccounts)
        .values({ ...account, userId: userA.id });

      await expect(
        violatedConstraint(
          connection.db
            .insert(authAccounts)
            .values({ ...account, userId: userB.id }),
        ),
      ).resolves.toBe('auth_accounts_provider_provider_account_id_unique');
    });
  });

  describe('auth_tokens', () => {
    it('rejects a duplicate token hash', async () => {
      const user = await insertUser(connection.db);
      const token = {
        userId: user.id,
        purpose: 'password_reset',
        tokenHash: 'token-hash',
        expiresAt: inOneHour(),
      } as const;
      await connection.db.insert(authTokens).values(token);

      await expect(
        violatedConstraint(
          connection.db
            .insert(authTokens)
            .values({ ...token, purpose: 'email_verification' }),
        ),
      ).resolves.toBe('auth_tokens_token_hash_unique');
    });
  });
});
