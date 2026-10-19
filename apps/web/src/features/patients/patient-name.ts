import type { Patient } from '@nutri/schemas';

export function patientFullName(
  patient: Pick<Patient, 'firstName' | 'lastName'>,
) {
  return `${patient.firstName} ${patient.lastName}`;
}
