import {
  patientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
} from '@nutri/schemas';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

export const patientKeys = {
  all: ['patients'] as const,
  detail: (patientId: string) => [...patientKeys.all, patientId] as const,
};

export function patientsQueryOptions() {
  return queryOptions({
    queryKey: patientKeys.all,
    queryFn: () => apiClient.get('/clinic/patients', z.array(patientSchema)),
  });
}

export function patientQueryOptions(patientId: string) {
  return queryOptions({
    queryKey: patientKeys.detail(patientId),
    queryFn: () =>
      apiClient.get(`/clinic/patients/${patientId}`, patientSchema),
  });
}

/** Both writes invalidate every patients query: the detail key is nested
 * under `all`, so the list and any open profile refetch. */
export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePatientInput) =>
      apiClient.post('/clinic/patients', body, patientSchema),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useUpdatePatient(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePatientInput) =>
      apiClient.patch(`/clinic/patients/${patientId}`, body, patientSchema),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
  });
}
