import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api-client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (4xx) will not succeed on retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiClientError && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}
