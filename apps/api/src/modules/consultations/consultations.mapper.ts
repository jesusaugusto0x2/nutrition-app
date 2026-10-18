import type { Consultation } from '@nutri/schemas';
import type { ConsultationRow } from './consultations.repository';

/** Maps a database row to the API shape. Internal columns are not exposed. */
export function toConsultation(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    patientId: row.patientId,
    date: row.date,
    weightKg: row.weightKg,
    heightM: row.heightM,
    armCm: row.armCm,
    waistCm: row.waistCm,
    legCm: row.legCm,
    hipCm: row.hipCm,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
