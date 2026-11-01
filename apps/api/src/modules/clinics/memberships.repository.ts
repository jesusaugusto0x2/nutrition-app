import { Inject, Injectable } from '@nestjs/common';
import type { AuthMembership } from '@nutri/schemas';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { clinics, memberships } from '../../database/schema';

/**
 * Data access for memberships. Lookups go by user, not by clinic: this is how
 * a request gets its clinic in the first place.
 */
@Injectable()
export class MembershipsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findFirstClinicIdByUser(userId: string): Promise<string | null> {
    const [membership] = await this.db
      .select({ clinicId: memberships.clinicId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.createdAt), asc(memberships.id))
      .limit(1);
    return membership?.clinicId ?? null;
  }

  /** Oldest first, so the first one is the clinic requests run in. */
  findAllByUser(userId: string): Promise<AuthMembership[]> {
    return this.db
      .select({
        clinicId: memberships.clinicId,
        clinicName: clinics.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(clinics, eq(clinics.id, memberships.clinicId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.createdAt), asc(memberships.id));
  }
}
