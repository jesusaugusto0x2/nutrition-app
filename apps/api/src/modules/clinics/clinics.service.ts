import { Injectable } from '@nestjs/common';
import { MembershipsRepository } from './memberships.repository';

@Injectable()
export class ClinicsService {
  constructor(private readonly membershipsRepository: MembershipsRepository) {}

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
}
