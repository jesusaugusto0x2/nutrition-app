import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { clinics } from '../../database/schema';

@Injectable()
export class ClinicsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async exists(clinicId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);
    return rows.length > 0;
  }
}
