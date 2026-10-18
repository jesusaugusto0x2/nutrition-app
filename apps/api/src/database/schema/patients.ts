import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { baseColumns, softDeleteColumn } from './columns';

export const patientSex = pgEnum('patient_sex', ['female', 'male']);

export const patients = pgTable(
  'patients',
  {
    ...baseColumns,
    clinicId: uuid()
      .notNull()
      .references(() => clinics.id),
    firstName: text().notNull(),
    lastName: text().notNull(),
    birthDate: date({ mode: 'string' }).notNull(),
    sex: patientSex().notNull(),
    phone: text(),
    address: text(),
    ...softDeleteColumn,
  },
  (table) => [
    index().on(table.clinicId),
    // Target of the composite foreign key in consultations, which guarantees
    // a consultation always belongs to the same clinic as its patient.
    unique('patients_id_clinic_id_unique').on(table.id, table.clinicId),
  ],
);
