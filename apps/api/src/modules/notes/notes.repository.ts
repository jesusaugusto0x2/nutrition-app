import { Inject, Injectable } from '@nestjs/common';
import type { CreateNoteInput } from '@nutri/schemas';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { patientNotes } from '../../database/schema';
import type { Transaction } from '../../database/transaction-runner';

export type NoteRow = typeof patientNotes.$inferSelect;

/**
 * Data access for internal patient notes. Every query is scoped to a clinic
 * and excludes soft-deleted rows.
 */
@Injectable()
export class NotesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Most recent first. */
  findByPatient(clinicId: string, patientId: string): Promise<NoteRow[]> {
    return this.db
      .select()
      .from(patientNotes)
      .where(
        and(
          eq(patientNotes.clinicId, clinicId),
          eq(patientNotes.patientId, patientId),
          isNull(patientNotes.deletedAt),
        ),
      )
      .orderBy(desc(patientNotes.createdAt), desc(patientNotes.id));
  }

  async create(
    clinicId: string,
    patientId: string,
    createdBy: string,
    input: CreateNoteInput,
    tx?: Transaction,
  ): Promise<NoteRow> {
    const [row] = await (tx ?? this.db)
      .insert(patientNotes)
      .values({ ...input, clinicId, patientId, createdBy })
      .returning();
    return row;
  }

  /**
   * Soft-deletes a note (clinical records are never physically deleted).
   * Returns undefined when it does not exist, is soft-deleted or belongs to
   * another clinic, so ids cannot be probed.
   */
  async softDelete(
    clinicId: string,
    patientId: string,
    noteId: string,
    deletedAt: Date,
    tx?: Transaction,
  ): Promise<NoteRow | undefined> {
    const [row] = await (tx ?? this.db)
      .update(patientNotes)
      .set({ deletedAt })
      .where(
        and(
          eq(patientNotes.clinicId, clinicId),
          eq(patientNotes.patientId, patientId),
          eq(patientNotes.id, noteId),
          isNull(patientNotes.deletedAt),
        ),
      )
      .returning();
    return row;
  }
}
