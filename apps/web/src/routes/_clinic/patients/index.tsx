import { createFileRoute } from '@tanstack/react-router';
import { patientsQueryOptions } from '@/features/patients/api';
import { PatientList } from '@/features/patients/components/patient-list';

export const Route = createFileRoute('/_clinic/patients/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(patientsQueryOptions()),
  component: PatientList,
});
