import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { PatientsService } from '../patients/patients.service';
import {
  ConsultationsRepository,
  type ConsultationRow,
} from './consultations.repository';
import { ConsultationsService } from './consultations.service';

const CLINIC_ID = '00000000-0000-4000-8000-00000000000a';
const PATIENT_ID = '00000000-0000-4000-8000-00000000000b';
const CONSULTATION_ID = '00000000-0000-4000-8000-00000000000c';
const NOW = new Date('2026-02-01T10:00:00.000Z');

const row: ConsultationRow = {
  id: CONSULTATION_ID,
  clinicId: CLINIC_ID,
  patientId: PATIENT_ID,
  date: '2026-01-15',
  weightKg: 70.5,
  heightM: 1.7,
  armCm: null,
  waistCm: 80,
  legCm: null,
  hipCm: null,
  notes: null,
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  updatedAt: new Date('2026-01-15T10:00:00.000Z'),
  deletedAt: null,
};

describe('ConsultationsService', () => {
  let service: ConsultationsService;
  const repository = {
    findByPatient: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const patientsService = { assertExists: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultationsService,
        { provide: ConsultationsRepository, useValue: repository },
        { provide: PatientsService, useValue: patientsService },
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile();
    service = moduleRef.get(ConsultationsService);
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
      expect.objectContaining({ id: row.id, weightKg: 70.5 }),
    ]);
    expect(result[0]).not.toHaveProperty('clinicId');
  });

  it('does not touch consultations of a patient outside the clinic', async () => {
    patientsService.assertExists.mockRejectedValue(new NotFoundException());

    await expect(service.listByPatient(CLINIC_ID, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.create(CLINIC_ID, PATIENT_ID, {
        date: '2026-01-15',
        weightKg: 70,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.findByPatient).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates the consultation for the clinic and patient', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.create.mockResolvedValue(row);
    const input = { date: '2026-01-15', weightKg: 70.5 };

    await service.create(CLINIC_ID, PATIENT_ID, input);

    expect(repository.create).toHaveBeenCalledWith(
      CLINIC_ID,
      PATIENT_ID,
      input,
    );
  });

  it('updates the consultation and returns the mapped record', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.update.mockResolvedValue(row);
    const input = { date: '2026-01-20', weightKg: 69.5 };

    const result = await service.update(
      CLINIC_ID,
      PATIENT_ID,
      CONSULTATION_ID,
      input,
    );

    expect(repository.update).toHaveBeenCalledWith(
      CLINIC_ID,
      PATIENT_ID,
      CONSULTATION_ID,
      input,
    );
    expect(result).toEqual(
      expect.objectContaining({ id: CONSULTATION_ID, weightKg: 70.5 }),
    );
    expect(result).not.toHaveProperty('clinicId');
  });

  it('answers 404 when updating a consultation outside the clinic', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.update.mockResolvedValue(undefined);

    await expect(
      service.update(
        CLINIC_ID,
        PATIENT_ID,
        '00000000-0000-4000-8000-0000000000ff',
        { date: '2026-01-20', weightKg: 69.5 },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not update when the patient is outside the clinic', async () => {
    patientsService.assertExists.mockRejectedValue(new NotFoundException());

    await expect(
      service.update(CLINIC_ID, PATIENT_ID, CONSULTATION_ID, {
        date: '2026-01-20',
        weightKg: 69.5,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('soft-deletes with the clock time', async () => {
    patientsService.assertExists.mockResolvedValue(undefined);
    repository.softDelete.mockResolvedValue({ ...row, deletedAt: NOW });

    await service.softDelete(CLINIC_ID, PATIENT_ID, CONSULTATION_ID);

    expect(repository.softDelete).toHaveBeenCalledWith(
      CLINIC_ID,
      PATIENT_ID,
      CONSULTATION_ID,
      NOW,
    );
  });

  it('answers 404 when deleting a consultation outside the clinic', async () => {
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

  it('does not delete when the patient is outside the clinic', async () => {
    patientsService.assertExists.mockRejectedValue(new NotFoundException());

    await expect(
      service.softDelete(CLINIC_ID, PATIENT_ID, CONSULTATION_ID),
    ).rejects.toThrow(NotFoundException);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
