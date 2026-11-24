import type { Patient, PatientListItem } from '@nutri/schemas';
import type { PatientListRow, PatientRow } from './patients.repository';

/** Maps a database row to the API shape. Internal columns are not exposed. */
export function toPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate,
    sex: row.sex,
    phone: row.phone,
    address: row.address,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Adds the weight summary of the latest consultations to the patient. */
export function toPatientListItem(row: PatientListRow): PatientListItem {
  const { currentWeight, previousWeight, lastConsultationDate } = row;
  return {
    ...toPatient(row.patient),
    lastConsultation:
      lastConsultationDate !== null && currentWeight !== null
        ? { date: lastConsultationDate, weightKg: currentWeight }
        : null,
    currentWeight,
    // The trend is a difference of two-decimal weights: round it so float
    // arithmetic does not leak (69.5 - 70.05 is -0.54999...).
    trendWeightKg:
      currentWeight !== null && previousWeight !== null
        ? Math.round((currentWeight - previousWeight) * 100) / 100
        : null,
  };
}
