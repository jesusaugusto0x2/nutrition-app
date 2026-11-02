import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../database/transaction-runner';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { PatientAccessService } from '../../modules/portal/patient-access.service';
import { CredentialsRepository } from '../credentials/credentials.repository';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly clinics: ClinicsService,
    private readonly patientAccess: PatientAccessService,
    private readonly transactions: TransactionRunner,
  ) {}

  /**
   * Creates the first clinic of a user who has neither a membership nor
   * portal access (a new Google sign-in). The user's row stays locked from
   * the check to the insert, so two concurrent requests create one clinic.
   */
  async createClinic(userId: string, clinicName: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      await this.credentials.lockUser(userId, tx);

      const memberships = await this.clinics.listMembershipsForUser(userId, tx);
      const access = await this.patientAccess.listForUser(userId, tx);
      if (memberships.length > 0 || access.length > 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'This account does not need onboarding',
        });
      }

      await this.clinics.createWithOwner(
        { name: clinicName, ownerId: userId },
        tx,
      );
    });
  }
}
