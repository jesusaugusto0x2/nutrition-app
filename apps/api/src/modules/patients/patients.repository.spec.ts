import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { patients } from '../../database/schema';
import { createTestDatabase } from '../../database/testing/test-database';
import { insertClinic, insertPatient } from '../../database/testing/fixtures';
import { PatientsRepository } from './patients.repository';

describe('PatientsRepository', () => {
  let connection: DatabaseConnection;
  let repository: PatientsRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new PatientsRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('clinic isolation', () => {
    it('lists only the patients of the requested clinic', async () => {
      const clinicA = await insertClinic(connection.db, 'Clinic A');
      const clinicB = await insertClinic(connection.db, 'Clinic B');
      const patientA = await insertPatient(connection.db, clinicA.id);
      await insertPatient(connection.db, clinicB.id);

      const result = await repository.findAll(clinicA.id);

      expect(result.map((patient) => patient.id)).toEqual([patientA.id]);
    });

    it("cannot read another clinic's patient by id", async () => {
      const clinicA = await insertClinic(connection.db);
      const clinicB = await insertClinic(connection.db);
      const patientOfB = await insertPatient(connection.db, clinicB.id);

      await expect(
        repository.findById(clinicA.id, patientOfB.id),
      ).resolves.toBeUndefined();
    });

    it("cannot update another clinic's patient", async () => {
      const clinicA = await insertClinic(connection.db);
      const clinicB = await insertClinic(connection.db);
      const patientOfB = await insertPatient(connection.db, clinicB.id, {
        firstName: 'Original',
      });

      const result = await repository.update(clinicA.id, patientOfB.id, {
        firstName: 'Hijacked',
      });

      expect(result).toBeUndefined();
      const [stored] = await connection.db
        .select()
        .from(patients)
        .where(eq(patients.id, patientOfB.id));
      expect(stored.firstName).toBe('Original');
    });

    it('creates patients in the given clinic', async () => {
      const clinic = await insertClinic(connection.db);

      const created = await repository.create(clinic.id, {
        firstName: 'Ana',
        lastName: 'Pérez',
        birthDate: '1990-05-10',
        sex: 'female',
      });

      expect(created.clinicId).toBe(clinic.id);
      await expect(
        repository.findById(clinic.id, created.id),
      ).resolves.toMatchObject({ firstName: 'Ana' });
    });
  });

  describe('soft delete', () => {
    it('excludes soft-deleted patients from list, get and update', async () => {
      const clinic = await insertClinic(connection.db);
      const deleted = await insertPatient(connection.db, clinic.id, {
        deletedAt: new Date(),
      });

      await expect(repository.findAll(clinic.id)).resolves.toEqual([]);
      await expect(
        repository.findById(clinic.id, deleted.id),
      ).resolves.toBeUndefined();
      await expect(
        repository.update(clinic.id, deleted.id, { firstName: 'X' }),
      ).resolves.toBeUndefined();
    });
  });

  it('orders patients by last name, then first name', async () => {
    const clinic = await insertClinic(connection.db);
    await insertPatient(connection.db, clinic.id, {
      firstName: 'Beatriz',
      lastName: 'Zamora',
    });
    await insertPatient(connection.db, clinic.id, {
      firstName: 'Carla',
      lastName: 'Alvarez',
    });
    await insertPatient(connection.db, clinic.id, {
      firstName: 'Ana',
      lastName: 'Alvarez',
    });

    const result = await repository.findAll(clinic.id);

    expect(result.map((p) => `${p.lastName} ${p.firstName}`)).toEqual([
      'Alvarez Ana',
      'Alvarez Carla',
      'Zamora Beatriz',
    ]);
  });

  it('refreshes updated_at on update', async () => {
    const clinic = await insertClinic(connection.db);
    const lastUpdate = new Date('2020-01-01T00:00:00.000Z');
    const patient = await insertPatient(connection.db, clinic.id, {
      updatedAt: lastUpdate,
    });

    const updated = await repository.update(clinic.id, patient.id, {
      phone: '555-0100',
    });

    expect(updated?.phone).toBe('555-0100');
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(lastUpdate.getTime());
  });
});
