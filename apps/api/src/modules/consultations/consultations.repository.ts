import { Inject, Injectable } from '@nestjs/common';
import type { CreateConsultationInput } from '@nutri/schemas';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { consultations } from '../../database/schema';

export type ConsultationRow = typeof consultations.$inferSelect;

/**
 * Data access for consultations. Every query is scoped to a clinic and
 * excludes soft-deleted rows.
 */
@Injectable()
export class ConsultationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Most recent first. */
  findByPatient(
    clinicId: string,
    patientId: string,
  ): Promise<ConsultationRow[]> {
    return this.db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.clinicId, clinicId),
          eq(consultations.patientId, patientId),
          isNull(consultations.deletedAt),
        ),
      )
      .orderBy(desc(consultations.date), desc(consultations.createdAt));
  }

  async create(
    clinicId: string,
    patientId: string,
    input: CreateConsultationInput,
  ): Promise<ConsultationRow> {
    const [row] = await this.db
      .insert(consultations)
      .values({ ...input, clinicId, patientId })
      .returning();
    return row;
  }
}
