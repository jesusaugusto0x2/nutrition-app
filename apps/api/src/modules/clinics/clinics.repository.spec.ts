import type { DatabaseConnection } from '../../database/client';
import { createTestDatabase } from '../../database/testing/test-database';
import { insertClinic } from '../../database/testing/fixtures';
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

  it('reports whether a clinic exists', async () => {
    const clinic = await insertClinic(connection.db);

    await expect(repository.exists(clinic.id)).resolves.toBe(true);
    await expect(
      repository.exists('00000000-0000-4000-8000-0000000000ff'),
    ).resolves.toBe(false);
  });
});
