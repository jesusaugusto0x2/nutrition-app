import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PatientsService } from '../patients/patients.service';
import {
  ConsultationsRepository,
  type ConsultationRow,
} from './consultations.repository';
import { ConsultationsService } from './consultations.service';

const CLINIC_ID = '00000000-0000-4000-8000-00000000000a';
const PATIENT_ID = '00000000-0000-4000-8000-00000000000b';

const row: ConsultationRow = {
  id: '00000000-0000-4000-8000-00000000000c',
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
  const repository = { findByPatient: vi.fn(), create: vi.fn() };
  const patientsService = { assertExists: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultationsService,
        { provide: ConsultationsRepository, useValue: repository },
        { provide: PatientsService, useValue: patientsService },
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
});
