import type { DatabaseConnection } from '../../database/client';
import {
  insertClinic,
  insertPatient,
  insertPatientAccess,
  insertUser,
} from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { PatientAccessRepository } from './patient-access.repository';

describe('PatientAccessRepository', () => {
  let connection: DatabaseConnection;
  let repository: PatientAccessRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new PatientAccessRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('lists the patients of the user, across clinics', async () => {
    const firstClinic = await insertClinic(connection.db);
    const secondClinic = await insertClinic(connection.db);
    const first = await insertPatient(connection.db, firstClinic.id);
    const second = await insertPatient(connection.db, secondClinic.id);
    const user = await insertUser(connection.db);
    await insertPatientAccess(connection.db, user.id, first.id, {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertPatientAccess(connection.db, user.id, second.id, {
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    await expect(repository.findPatientIdsByUser(user.id)).resolves.toEqual([
      first.id,
      second.id,
    ]);
  });

  it("does not list another user's patients", async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const owner = await insertUser(connection.db);
    await insertPatientAccess(connection.db, owner.id, patient.id);
    const other = await insertUser(connection.db);

    await expect(repository.findPatientIdsByUser(other.id)).resolves.toEqual(
      [],
    );
  });

  it('excludes soft-deleted patients', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id, {
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const user = await insertUser(connection.db);
    await insertPatientAccess(connection.db, user.id, patient.id);

    await expect(repository.findPatientIdsByUser(user.id)).resolves.toEqual([]);
  });

  it("lists the user's patients with names and relationship, across clinics", async () => {
    const firstClinic = await insertClinic(connection.db);
    const secondClinic = await insertClinic(connection.db);
    const first = await insertPatient(connection.db, firstClinic.id, {
      firstName: 'Luz',
      lastName: 'Rojas',
    });
    const second = await insertPatient(connection.db, secondClinic.id, {
      firstName: 'Mar',
      lastName: 'Rojas',
    });
    const user = await insertUser(connection.db);
    await insertPatientAccess(connection.db, user.id, second.id, {
      relationship: 'self',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await insertPatientAccess(connection.db, user.id, first.id, {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(repository.findAllByUser(user.id)).resolves.toEqual([
      {
        patientId: first.id,
        firstName: 'Luz',
        lastName: 'Rojas',
        relationship: 'guardian',
      },
      {
        patientId: second.id,
        firstName: 'Mar',
        lastName: 'Rojas',
        relationship: 'self',
      },
    ]);
  });

  it("does not list another user's patients with their names", async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const owner = await insertUser(connection.db);
    await insertPatientAccess(connection.db, owner.id, patient.id);
    const other = await insertUser(connection.db);

    await expect(repository.findAllByUser(other.id)).resolves.toEqual([]);
  });

  it('excludes soft-deleted patients from the list with names', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id, {
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const user = await insertUser(connection.db);
    await insertPatientAccess(connection.db, user.id, patient.id);

    await expect(repository.findAllByUser(user.id)).resolves.toEqual([]);
  });
});
