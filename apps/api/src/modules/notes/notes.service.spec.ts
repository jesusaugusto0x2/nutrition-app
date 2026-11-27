import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { PatientsService } from '../patients/patients.service';
import { NotesRepository, type NoteRow } from './notes.repository';
import { NotesService } from './notes.service';

const CLINIC_ID = '00000000-0000-4000-8000-00000000000a';
const PATIENT_ID = '00000000-0000-4000-8000-00000000000b';
const NOTE_ID = '00000000-0000-4000-8000-00000000000c';
const USER_ID = '00000000-0000-4000-8000-00000000000d';
const NOW = new Date('2026-02-01T10:00:00.000Z');

const row: NoteRow = {
  id: NOTE_ID,
  clinicId: CLINIC_ID,
  patientId: PATIENT_ID,
  body: 'Alergia al maní',
  createdBy: USER_ID,
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  updatedAt: new Date('2026-01-15T10:00:00.000Z'),
  deletedAt: null,
};

describe('NotesService', () => {
  let service: NotesService;
  const repository = {
    findByPatient: vi.fn(),
    create: vi.fn(),
    softDelete: vi.fn(),
  };
  const patientsService = { assertExists: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: NotesRepository, useValue: repository },
        { provide: PatientsService, useValue: patientsService },
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile();
    service = moduleRef.get(NotesService);
  });

  it('checks the patient belongs to the clinic before listing', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.findByPatient.mockResolvedValue([row]);

    const result = await service.listByPatient(CLINIC_ID, PATIENT_ID);

    expect(patientsService.assertExists).toHaveBeenCalledWith(
      CLINIC_ID,
      PATIENT_ID,
    );
    expect(result).toEqual([
      {
        id: NOTE_ID,
        patientId: PATIENT_ID,
        body: 'Alergia al maní',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      },
    ]);
    expect(result[0]).not.toHaveProperty('clinicId');
    expect(result[0]).not.toHaveProperty('deletedAt');
    expect(result[0]).not.toHaveProperty('createdBy');
  });

  it('does not touch notes of a patient outside the clinic', async () => {
    patientsService.assertExists.mockRejectedValue(new NotFoundException());

    await expect(service.listByPatient(CLINIC_ID, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.create(CLINIC_ID, PATIENT_ID, USER_ID, { body: 'Nota' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.softDelete(CLINIC_ID, PATIENT_ID, NOTE_ID),
    ).rejects.toThrow(NotFoundException);
    expect(repository.findByPatient).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('creates the note with its author', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.create.mockResolvedValue(row);

    await service.create(CLINIC_ID, PATIENT_ID, USER_ID, {
      body: 'Alergia al maní',
    });

    expect(repository.create).toHaveBeenCalledWith(
      CLINIC_ID,
      PATIENT_ID,
      USER_ID,
      { body: 'Alergia al maní' },
    );
  });

  it('soft-deletes with the clock time', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.softDelete.mockResolvedValue({ ...row, deletedAt: NOW });

    await service.softDelete(CLINIC_ID, PATIENT_ID, NOTE_ID);

    expect(repository.softDelete).toHaveBeenCalledWith(
      CLINIC_ID,
      PATIENT_ID,
      NOTE_ID,
      NOW,
    );
  });

  it('answers 404 when deleting a note outside the clinic', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.softDelete.mockResolvedValue(undefined);

    await expect(
      service.softDelete(
        CLINIC_ID,
        PATIENT_ID,
        '00000000-0000-4000-8000-0000000000ff',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
