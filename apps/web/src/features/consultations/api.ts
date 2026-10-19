import { consultationSchema } from '@nutri/schemas';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

export const consultationKeys = {
  byPatient: (patientId: string) =>
    ['patients', patientId, 'consultations'] as const,
};

/** Consultations of a patient, most recent first. */
export function consultationsQueryOptions(patientId: string) {
  return queryOptions({
    queryKey: consultationKeys.byPatient(patientId),
    queryFn: () =>
      apiClient.get(
        `/clinic/patients/${patientId}/consultations`,
        z.array(consultationSchema),
      ),
  });
}
