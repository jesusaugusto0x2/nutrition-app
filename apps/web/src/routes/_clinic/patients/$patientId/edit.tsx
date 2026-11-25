import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { NotFoundState } from '@/components/not-found-state';
import { patientQueryOptions } from '@/features/patients/api';
import { PatientForm } from '@/features/patients/components/patient-form';
import { t } from '@/i18n';
import { ApiClientError } from '@/lib/api-client';

export const Route = createFileRoute('/_clinic/patients/$patientId/edit')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        patientQueryOptions(params.patientId),
      );
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
  component: EditPatientPage,
  notFoundComponent: () => <NotFoundState title={t.patients.notFound} />,
});

function EditPatientPage() {
  const { patientId } = Route.useParams();
  const { data: patient } = useSuspenseQuery(patientQueryOptions(patientId));

  return (
    <div className="space-y-6">
      <Link
        to="/patients/$patientId"
        params={{ patientId }}
        className="text-muted-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.common.back}
      </Link>
      <h1 className="m-0 font-heading text-display font-medium">
        {t.patients.form.editTitle}
      </h1>
      <div className="max-w-[560px]">
        <PatientForm patient={patient} />
      </div>
    </div>
  );
}
