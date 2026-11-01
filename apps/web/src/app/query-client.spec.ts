import { ApiClientError } from '@/lib/api-client';
import { createQueryClient } from './query-client';

const unauthorized = new ApiClientError(401, null);
const invalidCredentials = new ApiClientError(401, {
  statusCode: 401,
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
  path: '/api/auth/sign-in',
  timestamp: '2026-01-01T10:00:00.000Z',
});

function fail(error: unknown) {
  return () => Promise.reject(error instanceof Error ? error : new Error());
}

describe('createQueryClient', () => {
  it('reports a 401 from a query', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient(onUnauthorized);

    await queryClient
      .fetchQuery({ queryKey: ['test'], queryFn: fail(unauthorized) })
      .catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports a 401 from a mutation', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient(onUnauthorized);
    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: fail(unauthorized) });

    await mutation.execute(undefined).catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat a wrong password as a lost session', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient(onUnauthorized);
    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: fail(invalidCredentials) });

    await mutation.execute(undefined).catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignores other errors', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient(onUnauthorized);

    await queryClient
      .fetchQuery({
        queryKey: ['test'],
        queryFn: fail(new ApiClientError(403, null)),
      })
      .catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
