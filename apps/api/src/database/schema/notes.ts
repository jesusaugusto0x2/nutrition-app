import { foreignKey, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { baseColumns, softDeleteColumn } from './columns';
import { patients } from './patients';
import { users } from './users';

export const patientNotes = pgTable(
  'patient_notes',
  {
    ...baseColumns,
    patientId: uuid().notNull(),
    clinicId: uuid()
      .notNull()
      .references(() => clinics.id),
    body: text().notNull(),
    // Who wrote it, kept for audit; the API does not expose it yet.
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    ...softDeleteColumn,
  },
  (table) => [
    // Composite key: the patient must belong to the note's clinic.
    foreignKey({
      columns: [table.patientId, table.clinicId],
      foreignColumns: [patients.id, patients.clinicId],
    }),
    index().on(table.patientId),
    index().on(table.clinicId),
  ],
);
