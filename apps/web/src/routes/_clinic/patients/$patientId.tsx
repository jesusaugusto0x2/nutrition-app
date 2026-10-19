import { createFileRoute, notFound } from '@tanstack/react-router';
import { NotFoundState } from '@/components/not-found-state';
import { consultationsQueryOptions } from '@/features/consultations/api';
import { patientQueryOptions } from '@/features/patients/api';
import { PatientProfile } from '@/features/patients/components/patient-profile';
import { t } from '@/i18n';
import { ApiClientError } from '@/lib/api-client';

export const Route = createFileRoute('/_clinic/patients/$patientId')({
  loader: async ({ context, params }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          patientQueryOptions(params.patientId),
        ),
        context.queryClient.ensureQueryData(
          consultationsQueryOptions(params.patientId),
        ),
      ]);
    } catch (error) {
      // Unknown ids, ids from another clinic and malformed ids all mean
      // "not found" to the user.
      if (
        error instanceof ApiClientError &&
        (error.status === 404 || error.status === 400)
      ) {
        throw notFound();
      }
      throw error;
    }
  },
  component: PatientProfileRoute,
  notFoundComponent: () => <NotFoundState title={t.patients.notFound} />,
});

function PatientProfileRoute() {
  const { patientId } = Route.useParams();
  return <PatientProfile patientId={patientId} />;
}
