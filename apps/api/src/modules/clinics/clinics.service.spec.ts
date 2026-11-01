import { Test } from '@nestjs/testing';
import { ClinicsService } from './clinics.service';
import { MembershipsRepository } from './memberships.repository';

const USER_ID = '00000000-0000-4000-8000-000000000002';
const CLINIC_ID = '00000000-0000-4000-8000-000000000001';

describe('ClinicsService', () => {
  const repository = { findFirstClinicIdByUser: vi.fn() };
  let service: ClinicsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: MembershipsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ClinicsService);
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
});
