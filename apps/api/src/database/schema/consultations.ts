import {
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { baseColumns, softDeleteColumn } from './columns';
import { patients } from './patients';

const centimeters = () => numeric({ precision: 5, scale: 1, mode: 'number' });

export const consultations = pgTable(
  'consultations',
  {
    ...baseColumns,
    patientId: uuid().notNull(),
    clinicId: uuid()
      .notNull()
      .references(() => clinics.id),
    date: date({ mode: 'string' }).notNull(),
    weightKg: numeric({ precision: 5, scale: 2, mode: 'number' }).notNull(),
    heightM: numeric({ precision: 3, scale: 2, mode: 'number' }),
    armCm: centimeters(),
    waistCm: centimeters(),
    legCm: centimeters(),
    hipCm: centimeters(),
    notes: text(),
    ...softDeleteColumn,
  },
  (table) => [
    // Composite key: the patient must belong to the consultation's clinic.
    foreignKey({
      columns: [table.patientId, table.clinicId],
      foreignColumns: [patients.id, patients.clinicId],
    }),
    index().on(table.patientId),
    index().on(table.clinicId),
  ],
);
