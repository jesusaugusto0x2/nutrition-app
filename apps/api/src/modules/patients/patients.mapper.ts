import type { Patient } from '@nutri/schemas';
import type { PatientRow } from './patients.repository';

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
