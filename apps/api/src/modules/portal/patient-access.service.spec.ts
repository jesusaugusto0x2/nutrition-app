import { Test } from '@nestjs/testing';
import { PatientAccessRepository } from './patient-access.repository';
import { PatientAccessService } from './patient-access.service';

const USER_ID = '00000000-0000-4000-8000-000000000003';
const PATIENT_ID = '00000000-0000-4000-8000-000000000010';

describe('PatientAccessService', () => {
  const repository = { findPatientIdsByUser: vi.fn() };
  let service: PatientAccessService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PatientAccessService,
        { provide: PatientAccessRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(PatientAccessService);
  });

  it('lists the patients the user can see', async () => {
    repository.findPatientIdsByUser.mockResolvedValue([PATIENT_ID]);

    await expect(service.listPatientIds(USER_ID)).resolves.toEqual([
      PATIENT_ID,
    ]);
    expect(repository.findPatientIdsByUser).toHaveBeenCalledWith(USER_ID);
  });
});
