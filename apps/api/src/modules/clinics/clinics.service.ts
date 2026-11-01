import { Injectable } from '@nestjs/common';
import type { AuthMembership } from '@nutri/schemas';
import type { Transaction } from '../../database/transaction-runner';
import { ClinicsRepository } from './clinics.repository';
import { MembershipsRepository } from './memberships.repository';

export interface NewClinic {
  name: string;
  ownerId: string;
}

@Injectable()
export class ClinicsService {
  constructor(
    private readonly clinicsRepository: ClinicsRepository,
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  /**
   * Creates a clinic and its `owner` membership. Two writes, so `tx` is
   * required: a clinic must never exist without its owner.
   */
  async createWithOwner(
    { name, ownerId }: NewClinic,
    tx: Transaction,
  ): Promise<void> {
    const clinicId = await this.clinicsRepository.create(name, tx);
    await this.membershipsRepository.create(
      { userId: ownerId, clinicId, role: 'owner' },
      tx,
    );
  }

  /**
   * The clinic the user works in, or `null` without a membership.
   *
   * TODO(auth): the MVP has one membership per user, so the oldest one wins.
   * Letting a user with several clinics pick one is out of scope for #12; it
   * needs a clinic selector in the web app and the choice on each request.
   */
  findClinicIdForUser(userId: string): Promise<string | null> {
    return this.membershipsRepository.findFirstClinicIdByUser(userId);
  }

  /** The clinics the user works in; empty for anyone else. */
  listMembershipsForUser(userId: string): Promise<AuthMembership[]> {
    return this.membershipsRepository.findAllByUser(userId);
  }
}
