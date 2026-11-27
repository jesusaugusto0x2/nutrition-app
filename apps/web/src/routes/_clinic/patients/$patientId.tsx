import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { NotFoundState } from '@/components/not-found-state';
import { patientQueryOptions } from '@/features/patients/api';
import { t } from '@/i18n';
import { ApiClientError } from '@/lib/api-client';

/**
 * Parent of every `/patients/$patientId/*` route. It validates the patient
 * (so a deep link to any tab 404s like the profile always did) and preloads
 * the detail into the query cache; the children decide what to render.
 * Form routes (edit, new consultation) stay plain children of this layout.
 */
export const Route = createFileRoute('/_clinic/patients/$patientId')({
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
  component: () => <Outlet />,
  notFoundComponent: () => <NotFoundState title={t.patients.notFound} />,
});
