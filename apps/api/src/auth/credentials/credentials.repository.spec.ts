import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { users } from '../../database/schema';
import { insertUser } from '../../database/testing/fixtures';
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
});
