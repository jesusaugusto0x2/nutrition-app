import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { memberships } from '../../database/schema';

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
}
