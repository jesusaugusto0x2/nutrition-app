import { ConsultationList } from '@/features/consultations/components/consultation-list';
import { PatientShell } from './patient-shell';

/** Resumen tab (default): the patient's consultations. */
export function PatientProfile({ patientId }: { patientId: string }) {
  return (
    <PatientShell patientId={patientId} active="summary">
      <ConsultationList patientId={patientId} />
    </PatientShell>
  );
}
