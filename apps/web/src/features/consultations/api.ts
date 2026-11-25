import {
  consultationSchema,
  type CreateConsultationInput,
  type UpdateConsultationInput,
} from '@nutri/schemas';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { patientKeys } from '@/features/patients/api';

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

/**
 * Both writes invalidate `patientKeys.all`: the consultation keys nest under
 * it, and the patient list and profile show weight summaries built from
 * consultations, so everything refetches after a save.
 */
export function useCreateConsultation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConsultationInput) =>
      apiClient.post(
        `/clinic/patients/${patientId}/consultations`,
        body,
        consultationSchema,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useUpdateConsultation(
  patientId: string,
  consultationId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateConsultationInput) =>
      apiClient.patch(
        `/clinic/patients/${patientId}/consultations/${consultationId}`,
        body,
        consultationSchema,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
  });
}
