import type { AuthMe, Patient } from '@nutri/schemas';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  RouterContextProvider,
  RouterProvider,
} from '@tanstack/react-router';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { ApiClientError } from '@/lib/api-client';
import {
  authKeys,
  meQueryOptions,
  useForgotPassword,
  useResetPassword,
  useSignIn,
  useSignOut,
} from './api';

const me: AuthMe = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ana@example.com',
    name: 'Ana',
    emailVerified: true,
  },
  memberships: [
    {
      clinicId: '00000000-0000-4000-8000-000000000002',
      clinicName: 'Consultorio',
      role: 'owner',
    },
  ],
  patientAccess: [],
};
const patient: Patient = {
  id: '00000000-0000-4000-8000-000000000003',
  firstName: 'Paciente',
  lastName: 'Secreto',
  birthDate: '1990-05-10',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(respond: (path: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((path: string, init?: RequestInit) =>
    Promise.resolve(respond(path, init)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function wrapperFor(queryClient: QueryClient) {
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: ['/'] }),
  );
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    </QueryClientProvider>
  );
}

describe('auth api', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('meQueryOptions', () => {
    it('answers null for a signed-out visitor', async () => {
      stubFetch(() => json(401, null));
      const onUnauthorized = vi.fn();

      await expect(
        createQueryClient(onUnauthorized).fetchQuery(meQueryOptions()),
      ).resolves.toBeNull();
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('rethrows any other failure', async () => {
      stubFetch(() => json(403, null));

      await expect(
        createQueryClient(vi.fn()).fetchQuery(meQueryOptions()),
      ).rejects.toBeInstanceOf(ApiClientError);
    });
  });

  describe('useSignIn', () => {
    it('forgets the cached "signed out" so the next guard refetches', async () => {
      stubFetch(() => json(200, me.user));
      const queryClient = createQueryClient(vi.fn());
      queryClient.setQueryData(authKeys.me, null);
      const { result } = renderHook(() => useSignIn(), {
        wrapper: wrapperFor(queryClient),
      });

      await act(() =>
        result.current.mutateAsync({ email: 'a@b.co', password: 'x' }),
      );

      expect(queryClient.getQueryState(authKeys.me)).toBeUndefined();
    });
  });

  describe('useForgotPassword', () => {
    it('posts the email and expects no body back', async () => {
      const fetchMock = stubFetch(() => new Response(null, { status: 202 }));
      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: wrapperFor(createQueryClient(vi.fn())),
      });

      await act(() => result.current.mutateAsync({ email: 'a@b.co' }));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        expect.objectContaining({ body: '{"email":"a@b.co"}' }),
      );
    });
  });

  describe('useResetPassword', () => {
    it('clears the cache: the API ended every session', async () => {
      stubFetch(() => new Response(null, { status: 204 }));
      const queryClient = createQueryClient(vi.fn());
      queryClient.setQueryData(['patients'], [patient]);
      queryClient.setQueryData(authKeys.me, me);
      const { result } = renderHook(() => useResetPassword(), {
        wrapper: wrapperFor(queryClient),
      });

      await act(() =>
        result.current.mutateAsync({ token: 't', password: 'p' }),
      );

      expect(queryClient.getQueryData(['patients'])).toBeUndefined();
      expect(queryClient.getQueryData(authKeys.me)).toBeNull();
    });
  });

  describe('useSignOut', () => {
    function SignOutButton() {
      const signOut = useSignOut();
      return (
        <button type="button" onClick={() => signOut.mutate()}>
          sign out
        </button>
      );
    }

    async function signInAtPatients() {
      stubFetch((path) => {
        if (path === '/api/auth/me') return json(200, me);
        if (path === '/api/auth/sign-out') {
          return new Response(null, { status: 204 });
        }
        return json(200, [patient]);
      });
      const queryClient = createQueryClient(vi.fn());
      const history = createMemoryHistory({ initialEntries: ['/patients'] });
      const router = createAppRouter(queryClient, history);
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider
            router={router}
            InnerWrap={({ children }) => (
              <>
                {children}
                <SignOutButton />
              </>
            )}
          />
        </QueryClientProvider>,
      );
      await screen.findByText(/Secreto/);
      return { queryClient, router, history };
    }

    it('clears cached data and goes to the login page', async () => {
      const { queryClient, router } = await signInAtPatients();

      act(() => screen.getByRole('button', { name: 'sign out' }).click());

      await waitFor(() => {
        expect(router.state.location.href).toBe('/login');
      });
      await waitFor(() => {
        expect(queryClient.getQueryData(['patients'])).toBeUndefined();
      });
      expect(queryClient.getQueryData(authKeys.me)).toBeNull();
    });

    it('leaves no patient data behind when going back', async () => {
      const { queryClient, router, history } = await signInAtPatients();
      act(() => screen.getByRole('button', { name: 'sign out' }).click());
      await waitFor(() => {
        expect(queryClient.getQueryData(['patients'])).toBeUndefined();
      });

      act(() => history.back());

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/login');
        expect(router.state.status).toBe('idle');
      });
      expect(screen.queryByText(/Secreto/)).not.toBeInTheDocument();
      const cachedQueries = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data);
      expect(JSON.stringify(cachedQueries)).not.toMatch(/Secreto/);

      // The router keeps the matches it left, loader results included.
      const leftMatches: unknown[] = [];
      router.clearCache({
        filter: (match: { loaderData?: unknown }) => {
          leftMatches.push(match.loaderData);
          return false;
        },
      });
      expect(leftMatches).not.toHaveLength(0);
      expect(JSON.stringify(leftMatches)).not.toMatch(/Secreto/);
    });
  });
});
