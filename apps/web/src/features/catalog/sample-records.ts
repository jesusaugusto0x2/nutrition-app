import type { Consultation, Patient } from '@nutri/schemas';
import type { PatientSummary } from '@/features/patients/components/patient-row';

/** Fictional patients and consultations for the dev-only catalog. */

const timestamps = {
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
};

export const samplePatient: Patient = {
  id: '00000000-0000-4000-8000-0000000000a1',
  firstName: 'Laura',
  lastName: 'Méndez',
  birthDate: '1992-04-18',
  sex: 'female',
  phone: '0414-555-0132',
  address: null,
  ...timestamps,
};

export const sampleMinor: Patient = {
  ...samplePatient,
  id: '00000000-0000-4000-8000-0000000000a2',
  firstName: 'Sofía',
  lastName: 'Herrera',
  birthDate: '2017-02-03',
  phone: null,
};

function visit(
  index: number,
  date: string,
  values: Pick<
    Consultation,
    'weightKg' | 'armCm' | 'waistCm' | 'legCm' | 'hipCm'
  >,
  notes: string | null = null,
): Consultation {
  return {
    id: `00000000-0000-4000-8000-0000000000c${index}`,
    patientId: samplePatient.id,
    date,
    heightM: index === 1 ? 1.62 : null,
    notes,
    ...values,
    ...timestamps,
  };
}

/** Most recent first, as the API returns them. */
export const sampleConsultations: Consultation[] = [
  visit(
    4,
    '2026-06-02',
    { weightKg: 66.9, armCm: 29, waistCm: 85, legCm: 56, hipCm: 100 },
    'Mejoró el estreñimiento. Mantiene caminatas 3 veces por semana.',
  ),
  visit(
    3,
    '2026-05-05',
    { weightKg: 68.6, armCm: 30, waistCm: 87, legCm: 57, hipCm: 101 },
    'Duerme mejor. Se ajustan las cenas.',
  ),
  visit(2, '2026-04-07', {
    weightKg: 70.1,
    armCm: 30,
    waistCm: 89,
    legCm: 57,
    hipCm: 103,
  }),
  visit(1, '2026-03-10', {
    weightKg: 72.4,
    armCm: 31,
    waistCm: 92,
    legCm: 58,
    hipCm: 104,
  }),
];

export const sampleSummaries: PatientSummary[] = [
  {
    patient: samplePatient,
    lastConsultation: { date: '2026-06-02', weightKg: 66.9 },
    weightChange: -1.7,
  },
  {
    patient: { ...sampleMinor, id: '00000000-0000-4000-8000-0000000000a3' },
    lastConsultation: { date: '2026-09-21', weightKg: 31.4 },
    weightChange: 0.8,
  },
  {
    patient: {
      ...samplePatient,
      id: '00000000-0000-4000-8000-0000000000a4',
      firstName: 'Carlos',
      lastName: 'Rivas',
      birthDate: '1974-01-12',
    },
    lastConsultation: { date: '2026-09-28', weightKg: 88 },
    weightChange: 0,
  },
];
