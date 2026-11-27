import type { DatabaseConnection } from '../../database/client';
import { createTestDatabase } from '../../database/testing/test-database';
import {
  insertClinic,
  insertNote,
  insertPatient,
  insertUser,
} from '../../database/testing/fixtures';
import { NotesRepository } from './notes.repository';

describe('NotesRepository', () => {
  let connection: DatabaseConnection;
  let repository: NotesRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new NotesRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('lists a patient’s notes, most recent first', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const author = await insertUser(connection.db);
    await insertNote(connection.db, clinic.id, patient.id, author.id, {
      body: 'Primera',
      createdAt: new Date('2026-01-10T10:00:00.000Z'),
    });
    await insertNote(connection.db, clinic.id, patient.id, author.id, {
      body: 'Segunda',
      createdAt: new Date('2026-02-10T10:00:00.000Z'),
    });

    const result = await repository.findByPatient(clinic.id, patient.id);

    expect(result.map((note) => note.body)).toEqual(['Segunda', 'Primera']);
  });

  it("cannot read another clinic's notes", async () => {
    const clinicA = await insertClinic(connection.db);
    const clinicB = await insertClinic(connection.db);
    const author = await insertUser(connection.db);
    const patientOfB = await insertPatient(connection.db, clinicB.id);
    await insertNote(connection.db, clinicB.id, patientOfB.id, author.id);

    await expect(
      repository.findByPatient(clinicA.id, patientOfB.id),
    ).resolves.toEqual([]);
  });

  it('rejects a note whose clinic differs from the patient’s', async () => {
    const clinicA = await insertClinic(connection.db);
    const clinicB = await insertClinic(connection.db);
    const author = await insertUser(connection.db);
    const patientOfB = await insertPatient(connection.db, clinicB.id);

    // Enforced by the composite foreign key, not only by the service layer.
    await expect(
      repository.create(clinicA.id, patientOfB.id, author.id, {
        body: 'Cruzada',
      }),
    ).rejects.toThrow();
  });

  it('stores the author of the note', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const author = await insertUser(connection.db);

    const created = await repository.create(clinic.id, patient.id, author.id, {
      body: 'Alergia al maní',
    });

    expect(created).toMatchObject({
      body: 'Alergia al maní',
      createdBy: author.id,
      deletedAt: null,
    });
  });

  it('soft-deletes a note and it disappears from the list', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const author = await insertUser(connection.db);
    const note = await insertNote(
      connection.db,
      clinic.id,
      patient.id,
      author.id,
    );
    const deletedAt = new Date('2026-02-01T10:00:00.000Z');

    const deleted = await repository.softDelete(
      clinic.id,
      patient.id,
      note.id,
      deletedAt,
    );

    expect(deleted).toMatchObject({ id: note.id, deletedAt });
    await expect(
      repository.findByPatient(clinic.id, patient.id),
    ).resolves.toEqual([]);
  });

  it('does not soft-delete an already deleted note twice', async () => {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const author = await insertUser(connection.db);
    const note = await insertNote(
      connection.db,
      clinic.id,
      patient.id,
      author.id,
      {
        deletedAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    );

    await expect(
      repository.softDelete(
        clinic.id,
        patient.id,
        note.id,
        new Date('2026-02-02T10:00:00.000Z'),
      ),
    ).resolves.toBeUndefined();
  });

  it("cannot soft-delete another clinic's note", async () => {
    const clinicA = await insertClinic(connection.db);
    const clinicB = await insertClinic(connection.db);
    const author = await insertUser(connection.db);
    const patientOfB = await insertPatient(connection.db, clinicB.id);
    const noteOfB = await insertNote(
      connection.db,
      clinicB.id,
      patientOfB.id,
      author.id,
    );

    await expect(
      repository.softDelete(
        clinicA.id,
        patientOfB.id,
        noteOfB.id,
        new Date('2026-02-01T10:00:00.000Z'),
      ),
    ).resolves.toBeUndefined();
    await expect(
      repository.findByPatient(clinicB.id, patientOfB.id),
    ).resolves.toHaveLength(1);
  });
});
