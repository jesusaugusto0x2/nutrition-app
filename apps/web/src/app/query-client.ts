import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api-client';

/**
 * A wrong password is also a 401, but the visitor never had a session: the
 * login form shows that error itself.
 */
function isSessionLost(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.status === 401 &&
    error.body?.code !== 'INVALID_CREDENTIALS'
  );
}

export function createQueryClient(onUnauthorized: () => void): QueryClient {
  const onError = (error: unknown) => {
    if (isSessionLost(error)) {
      onUnauthorized();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
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
