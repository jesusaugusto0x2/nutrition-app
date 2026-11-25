import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { patients } from '../../database/schema';
import { createTestDatabase } from '../../database/testing/test-database';
import {
  insertClinic,
  insertConsultation,
  insertPatient,
} from '../../database/testing/fixtures';
import { PatientsRepository } from './patients.repository';

const BY_NAME = { sort: 'name' } as const;

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

      const result = await repository.findList(clinicA.id, BY_NAME);

      expect(result.map((row) => row.patient.id)).toEqual([patientA.id]);
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

      await expect(repository.findList(clinic.id, BY_NAME)).resolves.toEqual(
        [],
      );
      await expect(
        repository.findById(clinic.id, deleted.id),
      ).resolves.toBeUndefined();
      await expect(
        repository.update(clinic.id, deleted.id, { firstName: 'X' }),
      ).resolves.toBeUndefined();
    });

    it('ignores soft-deleted consultations in the weight summary', async () => {
      const clinic = await insertClinic(connection.db);
      const patient = await insertPatient(connection.db, clinic.id);
      await insertConsultation(connection.db, clinic.id, patient.id, {
        date: '2026-01-10',
        weightKg: 70,
      });
      await insertConsultation(connection.db, clinic.id, patient.id, {
        date: '2026-02-10',
        weightKg: 65,
        deletedAt: new Date(),
      });

      const [row] = await repository.findList(clinic.id, { sort: 'recent' });

      expect(row.lastConsultationDate).toBe('2026-01-10');
      expect(row.currentWeight).toBe(70);
      expect(row.previousWeight).toBeNull();
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

    const result = await repository.findList(clinic.id, BY_NAME);

    expect(result.map((row) => row.patient.lastName)).toEqual([
      'Alvarez',
      'Alvarez',
      'Zamora',
    ]);
    expect(result.map((row) => row.patient.firstName)).toEqual([
      'Ana',
      'Carla',
      'Beatriz',
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

  describe('weight summary', () => {
    it('returns the two latest consultation weights per patient', async () => {
      const clinic = await insertClinic(connection.db);
      const patient = await insertPatient(connection.db, clinic.id);
      await insertConsultation(connection.db, clinic.id, patient.id, {
        date: '2026-01-10',
        weightKg: 72,
      });
      await insertConsultation(connection.db, clinic.id, patient.id, {
        date: '2026-03-10',
        weightKg: 70.5,
      });
      await insertConsultation(connection.db, clinic.id, patient.id, {
        date: '2026-02-10',
        weightKg: 71,
      });

      const [row] = await repository.findList(clinic.id, { sort: 'recent' });

      expect(row.lastConsultationDate).toBe('2026-03-10');
      expect(row.currentWeight).toBe(70.5);
      expect(row.previousWeight).toBe(71);
    });

    it('returns null weights for a patient without consultations', async () => {
      const clinic = await insertClinic(connection.db);
      await insertPatient(connection.db, clinic.id);

      const [row] = await repository.findList(clinic.id, { sort: 'recent' });

      expect(row.lastConsultationDate).toBeNull();
      expect(row.currentWeight).toBeNull();
      expect(row.previousWeight).toBeNull();
    });

    it('never summarizes another clinic’s consultations', async () => {
      const clinicA = await insertClinic(connection.db);
      const clinicB = await insertClinic(connection.db);
      const patientOfB = await insertPatient(connection.db, clinicB.id);
      await insertConsultation(connection.db, clinicB.id, patientOfB.id, {
        weightKg: 65,
      });

      await expect(
        repository.findList(clinicA.id, { sort: 'recent' }),
      ).resolves.toEqual([]);
    });
  });

  describe('search', () => {
    it('matches names without regard to accents', async () => {
      const clinic = await insertClinic(connection.db);
      const maria = await insertPatient(connection.db, clinic.id, {
        firstName: 'María',
        lastName: 'Gómez',
      });
      await insertPatient(connection.db, clinic.id, {
        firstName: 'Pedro',
        lastName: 'Luna',
      });

      const result = await repository.findList(clinic.id, {
        q: 'maria',
        sort: 'recent',
      });

      expect(result.map((row) => row.patient.id)).toEqual([maria.id]);
    });

    it('matches partial names across first and last name', async () => {
      const clinic = await insertClinic(connection.db);
      const ana = await insertPatient(connection.db, clinic.id, {
        firstName: 'Ana',
        lastName: 'Pérez',
      });
      await insertPatient(connection.db, clinic.id, {
        firstName: 'Luis',
        lastName: 'Perales',
      });

      const result = await repository.findList(clinic.id, {
        q: 'ana per',
        sort: 'recent',
      });

      expect(result.map((row) => row.patient.id)).toEqual([ana.id]);
    });

    it('treats like wildcards in the search text literally', async () => {
      const clinic = await insertClinic(connection.db);
      await insertPatient(connection.db, clinic.id, {
        firstName: 'Ana',
        lastName: 'Pérez',
      });

      await expect(
        repository.findList(clinic.id, { q: '50%', sort: 'recent' }),
      ).resolves.toEqual([]);
    });

    it('never returns another clinic’s patients', async () => {
      const clinicA = await insertClinic(connection.db);
      const clinicB = await insertClinic(connection.db);
      await insertPatient(connection.db, clinicB.id, { firstName: 'María' });

      await expect(
        repository.findList(clinicA.id, { q: 'maria', sort: 'recent' }),
      ).resolves.toEqual([]);
    });
  });

  describe('sort', () => {
    it('puts the most recent consultation first and patients without any last', async () => {
      const clinic = await insertClinic(connection.db);
      const noConsultations = await insertPatient(connection.db, clinic.id, {
        firstName: 'Ana',
        lastName: 'Alvarez',
      });
      const older = await insertPatient(connection.db, clinic.id, {
        firstName: 'Beatriz',
        lastName: 'Zamora',
      });
      await insertConsultation(connection.db, clinic.id, older.id, {
        date: '2026-01-10',
      });
      const recent = await insertPatient(connection.db, clinic.id, {
        firstName: 'Carla',
        lastName: 'Mora',
      });
      await insertConsultation(connection.db, clinic.id, recent.id, {
        date: '2026-03-10',
      });

      const result = await repository.findList(clinic.id, { sort: 'recent' });

      expect(result.map((row) => row.patient.id)).toEqual([
        recent.id,
        older.id,
        noConsultations.id,
      ]);
    });
  });
});
