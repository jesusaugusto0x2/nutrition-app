import { Test } from '@nestjs/testing';
import type { Transaction } from '../../database/transaction-runner';
import { ClinicsRepository } from './clinics.repository';
import { ClinicsService } from './clinics.service';
import { MembershipsRepository } from './memberships.repository';

const USER_ID = '00000000-0000-4000-8000-000000000002';
const CLINIC_ID = '00000000-0000-4000-8000-000000000001';

describe('ClinicsService', () => {
  const clinicsRepository = { create: vi.fn() };
  const repository = {
    create: vi.fn(),
    findFirstClinicIdByUser: vi.fn(),
    findAllByUser: vi.fn(),
  };
  let service: ClinicsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: ClinicsRepository, useValue: clinicsRepository },
        { provide: MembershipsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ClinicsService);
  });

  it('creates the clinic and its owner inside the given transaction', async () => {
    const tx = {} as Transaction;
    clinicsRepository.create.mockResolvedValue(CLINIC_ID);

    await service.createWithOwner({ name: 'Clinic', ownerId: USER_ID }, tx);

    expect(clinicsRepository.create).toHaveBeenCalledWith('Clinic', tx);
    expect(repository.create).toHaveBeenCalledWith(
      { userId: USER_ID, clinicId: CLINIC_ID, role: 'owner' },
      tx,
    );
  });

  it("resolves the clinic from the user's membership", async () => {
    repository.findFirstClinicIdByUser.mockResolvedValue(CLINIC_ID);

    await expect(service.findClinicIdForUser(USER_ID)).resolves.toBe(CLINIC_ID);
    expect(repository.findFirstClinicIdByUser).toHaveBeenCalledWith(USER_ID);
  });

  it('resolves null for a user without a membership', async () => {
    repository.findFirstClinicIdByUser.mockResolvedValue(null);

    await expect(service.findClinicIdForUser(USER_ID)).resolves.toBeNull();
  });

  it("lists the user's memberships", async () => {
    const membership = {
      clinicId: CLINIC_ID,
      clinicName: 'Clinic',
      role: 'owner',
    };
    repository.findAllByUser.mockResolvedValue([membership]);

    await expect(service.listMembershipsForUser(USER_ID)).resolves.toEqual([
      membership,
    ]);
    expect(repository.findAllByUser).toHaveBeenCalledWith(USER_ID);
  });
});
