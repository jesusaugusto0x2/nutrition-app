import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { NotFoundState } from '@/components/not-found-state';
import { consultationsQueryOptions } from '@/features/consultations/api';
import { ConsultationForm } from '@/features/consultations/components/consultation-form';
import { patientQueryOptions } from '@/features/patients/api';
import { patientFullName } from '@/features/patients/patient-name';
import { t } from '@/i18n';
import { ApiClientError } from '@/lib/api-client';

export const Route = createFileRoute(
  '/_clinic/patients/$patientId/nueva-consulta',
)({
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
  component: NuevaConsultaPage,
  notFoundComponent: () => <NotFoundState title={t.patients.notFound} />,
});

function NuevaConsultaPage() {
  const { patientId } = Route.useParams();
  const { data: patient } = useSuspenseQuery(patientQueryOptions(patientId));
  const { data: consultations } = useSuspenseQuery(
    consultationsQueryOptions(patientId),
  );

  return (
    <div className="space-y-6">
      <Link
        to="/patients/$patientId"
        params={{ patientId }}
        className="text-muted-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {patientFullName(patient)}
      </Link>
      <h1 className="m-0 font-heading text-display font-medium">
        {t.consultations.newConsultation}
      </h1>
      <div className="max-w-[720px]">
        <ConsultationForm patientId={patientId} previous={consultations[0]} />
      </div>
    </div>
  );
}
