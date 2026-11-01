import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TransactionRunner } from '../../database/transaction-runner';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { PatientAccessService } from '../../modules/portal/patient-access.service';
import { CredentialsRepository } from '../credentials/credentials.repository';
import { OnboardingService } from './onboarding.service';

const TX = { transaction: true };

describe('OnboardingService', () => {
  const credentials = { lockUser: vi.fn() };
  const clinics = {
    listMembershipsForUser: vi.fn(),
    createWithOwner: vi.fn(),
  };
  const patientAccess = { listForUser: vi.fn() };
  let service: OnboardingService;

  beforeEach(async () => {
    vi.resetAllMocks();
    clinics.listMembershipsForUser.mockResolvedValue([]);
    patientAccess.listForUser.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: CredentialsRepository, useValue: credentials },
        { provide: ClinicsService, useValue: clinics },
        { provide: PatientAccessService, useValue: patientAccess },
        {
          provide: TransactionRunner,
          useValue: {
            run: (work: (tx: unknown) => Promise<unknown>) => work(TX),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(OnboardingService);
  });

  it('creates the clinic with the user as owner', async () => {
    await service.createClinic('user-1', 'Consultorio Ana');

    expect(clinics.createWithOwner).toHaveBeenCalledWith(
      { name: 'Consultorio Ana', ownerId: 'user-1' },
      TX,
    );
  });

  it('locks the user before checking, inside the same transaction', async () => {
    await service.createClinic('user-1', 'Consultorio Ana');

    expect(credentials.lockUser).toHaveBeenCalledWith('user-1', TX);
    expect(clinics.listMembershipsForUser).toHaveBeenCalledWith('user-1', TX);
    expect(patientAccess.listForUser).toHaveBeenCalledWith('user-1', TX);
    expect(credentials.lockUser.mock.invocationCallOrder[0]).toBeLessThan(
      clinics.listMembershipsForUser.mock.invocationCallOrder[0],
    );
  });

  it('rejects a user who already has a membership', async () => {
    clinics.listMembershipsForUser.mockResolvedValue([{ clinicId: 'clinic' }]);

    await expect(
      service.createClinic('user-1', 'Consultorio Ana'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(clinics.createWithOwner).not.toHaveBeenCalled();
  });

  it('rejects a user with portal access', async () => {
    patientAccess.listForUser.mockResolvedValue([{ patientId: 'patient' }]);

    await expect(
      service.createClinic('user-1', 'Consultorio Ana'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(clinics.createWithOwner).not.toHaveBeenCalled();
  });
});
