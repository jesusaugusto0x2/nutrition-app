import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateConsultationInput,
  UpdateConsultationInput,
} from '@nutri/schemas';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { consultations } from '../../database/schema';
import type { Transaction } from '../../database/transaction-runner';

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

  /**
   * Edits a consultation, replacing every editable field: an optional
   * measurement the update omits is cleared, not kept. Returns undefined
   * when it does not exist, is soft-deleted or belongs to another clinic,
   * so ids cannot be probed.
   */
  async update(
    clinicId: string,
    patientId: string,
    consultationId: string,
    input: UpdateConsultationInput,
    tx?: Transaction,
  ): Promise<ConsultationRow | undefined> {
    const [row] = await (tx ?? this.db)
      .update(consultations)
      .set({
        date: input.date,
        weightKg: input.weightKg,
        heightM: input.heightM ?? null,
        armCm: input.armCm ?? null,
        waistCm: input.waistCm ?? null,
        legCm: input.legCm ?? null,
        hipCm: input.hipCm ?? null,
        notes: input.notes ?? null,
      })
      .where(activeConsultation(clinicId, patientId, consultationId))
      .returning();
    return row;
  }

  /**
   * Soft-deletes a consultation (clinical records are never physically
   * deleted). Same lookup rules as update.
   */
  async softDelete(
    clinicId: string,
    patientId: string,
    consultationId: string,
    deletedAt: Date,
    tx?: Transaction,
  ): Promise<ConsultationRow | undefined> {
    const [row] = await (tx ?? this.db)
      .update(consultations)
      .set({ deletedAt })
      .where(activeConsultation(clinicId, patientId, consultationId))
      .returning();
    return row;
  }
}

function activeConsultation(
  clinicId: string,
  patientId: string,
  consultationId: string,
) {
  return and(
    eq(consultations.clinicId, clinicId),
    eq(consultations.patientId, patientId),
    eq(consultations.id, consultationId),
    isNull(consultations.deletedAt),
  );
}
