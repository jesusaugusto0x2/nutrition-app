import type { DatabaseConnection } from '../../database/client';
import { authAccounts } from '../../database/schema';
import { insertAuthAccount, insertUser } from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { AuthAccountsRepository } from './auth-accounts.repository';

describe('AuthAccountsRepository', () => {
  let connection: DatabaseConnection;
  const repository = new AuthAccountsRepository();

  beforeAll(async () => {
    connection = await createTestDatabase();
  });

  afterAll(async () => {
    await connection.close();
  });

  function inTransaction<T>(
    work: Parameters<typeof connection.db.transaction<T>>[0],
  ): Promise<T> {
    return connection.db.transaction(work);
  }

  describe('findUserId', () => {
    it('finds the user linked to the identity', async () => {
      const user = await insertUser(connection.db);
      await insertAuthAccount(connection.db, user.id, 'known-sub');

      await expect(
        inTransaction((tx) =>
          repository.findUserId(
            { provider: 'google', providerAccountId: 'known-sub' },
            tx,
          ),
        ),
      ).resolves.toBe(user.id);
    });

    it('finds nothing for an unknown identity', async () => {
      await expect(
        inTransaction((tx) =>
          repository.findUserId(
            { provider: 'google', providerAccountId: 'unknown-sub' },
            tx,
          ),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('link', () => {
    it('links an identity to a user', async () => {
      const user = await insertUser(connection.db);

      await inTransaction((tx) =>
        repository.link(
          user.id,
          { provider: 'google', providerAccountId: 'new-sub' },
          tx,
        ),
      );

      await expect(
        inTransaction((tx) =>
          repository.findUserId(
            { provider: 'google', providerAccountId: 'new-sub' },
            tx,
          ),
        ),
      ).resolves.toBe(user.id);
    });

    it('never moves a linked identity to another user', async () => {
      const owner = await insertUser(connection.db);
      const other = await insertUser(connection.db);
      await insertAuthAccount(connection.db, owner.id, 'taken-sub');

      await expect(
        inTransaction((tx) =>
          repository.link(
            other.id,
            { provider: 'google', providerAccountId: 'taken-sub' },
            tx,
          ),
        ),
      ).rejects.toThrow();

      const rows = await connection.db.select().from(authAccounts);
      expect(
        rows.filter((row) => row.providerAccountId === 'taken-sub'),
      ).toEqual([expect.objectContaining({ userId: owner.id })]);
    });
  });
});
