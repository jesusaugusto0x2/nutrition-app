import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PatientsRepository,
  type PatientListRow,
  type PatientRow,
} from './patients.repository';
import { PatientsService } from './patients.service';

const CLINIC_ID = '00000000-0000-4000-8000-00000000000a';
const PATIENT_ID = '00000000-0000-4000-8000-00000000000b';

const row: PatientRow = {
  id: PATIENT_ID,
  clinicId: CLINIC_ID,
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: '1990-05-10',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  deletedAt: null,
};

const listRow: PatientListRow = {
  patient: row,
  lastConsultationDate: '2026-03-10',
  currentWeight: 69.5,
  previousWeight: 70.05,
};

describe('PatientsService', () => {
  let service: PatientsService;
  const repository = {
    findList: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PatientsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(PatientsService);
  });

  it('scopes every repository call to the given clinic', async () => {
    repository.findList.mockResolvedValue([listRow]);
    repository.findById.mockResolvedValue(row);
    repository.update.mockResolvedValue(row);

    await service.list(CLINIC_ID, { sort: 'recent' });
    await service.getById(CLINIC_ID, PATIENT_ID);
    await service.update(CLINIC_ID, PATIENT_ID, { phone: '555' });

    expect(repository.findList).toHaveBeenCalledWith(CLINIC_ID, {
      sort: 'recent',
    });
    expect(repository.findById).toHaveBeenCalledWith(CLINIC_ID, PATIENT_ID);
    expect(repository.update).toHaveBeenCalledWith(CLINIC_ID, PATIENT_ID, {
      phone: '555',
    });
  });

  it('maps list rows to the API shape with a rounded trend', async () => {
    repository.findList.mockResolvedValue([listRow]);

    const [item] = await service.list(CLINIC_ID, { q: 'ana', sort: 'name' });

    expect(item).toEqual({
      id: PATIENT_ID,
      firstName: 'Ana',
      lastName: 'Pérez',
      birthDate: '1990-05-10',
      sex: 'female',
      phone: null,
      address: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
      lastConsultation: { date: '2026-03-10', weightKg: 69.5 },
      currentWeight: 69.5,
      trendWeightKg: -0.55,
    });
    expect(item).not.toHaveProperty('clinicId');
    expect(item).not.toHaveProperty('deletedAt');
  });

  it('maps a patient without consultations to null weights', async () => {
    repository.findList.mockResolvedValue([
      {
        patient: row,
        lastConsultationDate: null,
        currentWeight: null,
        previousWeight: null,
      },
    ]);

    const [item] = await service.list(CLINIC_ID, { sort: 'recent' });

    expect(item.lastConsultation).toBeNull();
    expect(item.currentWeight).toBeNull();
    expect(item.trendWeightKg).toBeNull();
  });

  it('maps rows to the API shape without internal columns', async () => {
    repository.findById.mockResolvedValue(row);

    const patient = await service.getById(CLINIC_ID, PATIENT_ID);

    expect(patient).toEqual({
      id: PATIENT_ID,
      firstName: 'Ana',
      lastName: 'Pérez',
      birthDate: '1990-05-10',
      sex: 'female',
      phone: null,
      address: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
    });
    expect(patient).not.toHaveProperty('clinicId');
    expect(patient).not.toHaveProperty('deletedAt');
  });

  it('throws NotFoundException when the patient is not in the clinic', async () => {
    repository.findById.mockResolvedValue(undefined);
    repository.update.mockResolvedValue(undefined);

    await expect(service.getById(CLINIC_ID, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.update(CLINIC_ID, PATIENT_ID, { phone: '555' }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.assertExists(CLINIC_ID, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates the patient in the given clinic', async () => {
    repository.create.mockResolvedValue(row);
    const input = {
      firstName: 'Ana',
      lastName: 'Pérez',
      birthDate: '1990-05-10',
      sex: 'female' as const,
    };

    await expect(service.create(CLINIC_ID, input)).resolves.toMatchObject({
      id: PATIENT_ID,
    });
    expect(repository.create).toHaveBeenCalledWith(CLINIC_ID, input);
  });
});
