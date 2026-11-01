import { Injectable } from '@nestjs/common';
import { PatientAccessRepository } from './patient-access.repository';

@Injectable()
export class PatientAccessService {
  constructor(
    private readonly patientAccessRepository: PatientAccessRepository,
  ) {}

  /** The patients the user can see in the portal; empty for anyone else. */
  listPatientIds(userId: string): Promise<string[]> {
    return this.patientAccessRepository.findPatientIdsByUser(userId);
  }
}
