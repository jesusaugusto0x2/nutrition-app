import { Injectable } from '@nestjs/common';
import type { AuthPatientAccess } from '@nutri/schemas';
import type { Transaction } from '../../database/transaction-runner';
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

  /** The same patients, with the names the web app shows. */
  listForUser(userId: string, tx?: Transaction): Promise<AuthPatientAccess[]> {
    return this.patientAccessRepository.findAllByUser(userId, tx);
  }
}
