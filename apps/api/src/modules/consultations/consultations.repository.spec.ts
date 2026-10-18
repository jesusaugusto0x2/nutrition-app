import type { DatabaseConnection } from '../../database/client';
import { createTestDatabase } from '../../database/testing/test-database';
import {
  insertClinic,
  insertConsultation,
  insertPatient,
} from '../../database/testing/fixtures';
import { ConsultationsRepository } from './consultations.repository';

describe('ConsultationsRepository', () => {
  let connection: DatabaseConnection;
  let repository: ConsultationsRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new ConsultationsRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('lists a patient’s consultations, most recent first', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    await insertConsultation(connection.db, clinic.id, patient.id, {
      date: '2026-01-10',
    });
    await insertConsultation(connection.db, clinic.id, patient.id, {
      date: '2026-03-10',
    });

    const result = await repository.findByPatient(clinic.id, patient.id);

    expect(result.map((c) => c.date)).toEqual(['2026-03-10', '2026-01-10']);
  });

  it("cannot read another clinic's consultations", async () => {
    const clinicA = await insertClinic(connection.db);
    const clinicB = await insertClinic(connection.db);
    const patientOfB = await insertPatient(connection.db, clinicB.id);
    await insertConsultation(connection.db, clinicB.id, patientOfB.id);

    await expect(
      repository.findByPatient(clinicA.id, patientOfB.id),
    ).resolves.toEqual([]);
  });

  it('rejects a consultation whose clinic differs from the patient’s', async () => {
    const clinicA = await insertClinic(connection.db);
    const clinicB = await insertClinic(connection.db);
    const patientOfB = await insertPatient(connection.db, clinicB.id);

    // Enforced by the composite foreign key, not only by the service layer.
    await expect(
      repository.create(clinicA.id, patientOfB.id, {
        date: '2026-01-15',
        weightKg: 70,
      }),
    ).rejects.toThrow();
  });

  it('excludes soft-deleted consultations', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    await insertConsultation(connection.db, clinic.id, patient.id, {
      deletedAt: new Date(),
    });

    await expect(
      repository.findByPatient(clinic.id, patient.id),
    ).resolves.toEqual([]);
  });

  it('stores decimal measurements as numbers', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);

    const created = await repository.create(clinic.id, patient.id, {
      date: '2026-01-15',
      weightKg: 72.45,
      heightM: 1.68,
      waistCm: 81.5,
    });

    expect(created).toMatchObject({
      weightKg: 72.45,
      heightM: 1.68,
      waistCm: 81.5,
      armCm: null,
    });
  });
});
