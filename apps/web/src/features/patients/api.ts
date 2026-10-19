import { patientSchema } from '@nutri/schemas';
import { queryOptions } from '@tanstack/react-query';
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
