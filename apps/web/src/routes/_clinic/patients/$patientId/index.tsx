import { createFileRoute } from '@tanstack/react-router';
import { consultationsQueryOptions } from '@/features/consultations/api';
import { PatientProfile } from '@/features/patients/components/patient-profile';

export const Route = createFileRoute('/_clinic/patients/$patientId/')({
  loader: ({ context, params }) =>
    // The parent layout already validated the patient and preloaded the
    // detail; here we only add what Resumen renders.
    context.queryClient.ensureQueryData(
      consultationsQueryOptions(params.patientId),
    ),
  component: PatientProfileRoute,
});

function PatientProfileRoute() {
  const { patientId } = Route.useParams();
  return <PatientProfile patientId={patientId} />;
}
