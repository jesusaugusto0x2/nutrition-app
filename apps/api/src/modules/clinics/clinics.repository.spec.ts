import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { clinics } from '../../database/schema';
import { createTestDatabase } from '../../database/testing/test-database';
import { ClinicsRepository } from './clinics.repository';

describe('ClinicsRepository', () => {
  let connection: DatabaseConnection;
  let repository: ClinicsRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new ClinicsRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('creates a clinic and returns its id', async () => {
    const id = await repository.create('Consultorio Ana');

    await expect(
      connection.db
        .select({ name: clinics.name })
        .from(clinics)
        .where(eq(clinics.id, id)),
    ).resolves.toEqual([{ name: 'Consultorio Ana' }]);
  });

  it('writes through the transaction it receives', async () => {
    let id = '';

    await expect(
      connection.db.transaction(async (tx) => {
        id = await repository.create('Rolled back', tx);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    await expect(
      connection.db.select().from(clinics).where(eq(clinics.id, id)),
    ).resolves.toEqual([]);
  });
});
