import { createFileRoute } from '@tanstack/react-router';
import { patientsQueryOptions } from '@/features/patients/api';
import { PatientList } from '@/features/patients/components/patient-list';

export const Route = createFileRoute('/_clinic/patients/')({
  // Returns nothing: the router keeps loader results in its own cache, where
  // patient data would survive `queryClient.clear()` on sign-out.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(patientsQueryOptions());
  },
  component: PatientList,
});
