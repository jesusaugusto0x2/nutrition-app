import type { AuthMe, Patient } from '@nutri/schemas';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { handleUnauthorized, meQueryOptions } from '@/features/auth/api';
import { t } from '@/i18n';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@example.com',
  name: 'Ana',
  emailVerified: true,
};
const membership = {
  clinicId: '00000000-0000-4000-8000-000000000002',
  clinicName: 'Consultorio',
  role: 'owner' as const,
};
const patientAccess = {
  patientId: '00000000-0000-4000-8000-000000000003',
  firstName: 'Ana',
  lastName: 'Pérez',
  relationship: 'self' as const,
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

const signedOut = null;
const staff: AuthMe = { user, memberships: [membership], patientAccess: [] };
const portalUser: AuthMe = {
  user,
  memberships: [],
  patientAccess: [patientAccess],
};
const noAccount: AuthMe = { user, memberships: [], patientAccess: [] };
const staffAndPortal: AuthMe = {
  user,
  memberships: [membership],
  patientAccess: [patientAccess],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Answers like the API would for this user. */
function stubApi(me: AuthMe | null, patientsStatus = 200) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    if (input === '/api/auth/me') {
      return Promise.resolve(me ? json(200, me) : json(401, null));
    }
    if (input === '/api/auth/sign-out') {
      expect(init?.method).toBe('POST');
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(json(patientsStatus, [patient]));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function startApp(path: string) {
  const queryClient = createQueryClient(() => {
    void handleUnauthorized(queryClient, router);
  });
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(queryClient, history);

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { queryClient, router, history };
}

async function expectLocation(
  router: ReturnType<typeof startApp>['router'],
  href: string,
) {
  await waitFor(() => {
    expect(router.state.location.href).toBe(href);
    expect(router.state.status).toBe('idle');
  });
}

describe('auth routing', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['signed out', signedOut, '/', '/login'],
    ['signed out', signedOut, '/login', '/login'],
    ['signed out', signedOut, '/patients', '/login?redirect=%2Fpatients'],
    ['signed out', signedOut, '/portal', '/login?redirect=%2Fportal'],
    ['signed out', signedOut, '/onboarding', '/login?redirect=%2Fonboarding'],
    ['staff', staff, '/', '/patients'],
    ['staff', staff, '/login', '/patients'],
    ['staff', staff, '/patients', '/patients'],
    ['staff', staff, '/portal', '/patients'],
    ['staff', staff, '/onboarding', '/patients'],
    ['portal', portalUser, '/', '/portal'],
    ['portal', portalUser, '/login', '/portal'],
    ['portal', portalUser, '/patients', '/portal'],
    ['portal', portalUser, '/portal', '/portal'],
    ['portal', portalUser, '/onboarding', '/portal'],
    ['neither', noAccount, '/', '/onboarding'],
    ['neither', noAccount, '/login', '/onboarding'],
    ['neither', noAccount, '/patients', '/onboarding'],
    ['neither', noAccount, '/portal', '/onboarding'],
    ['neither', noAccount, '/onboarding', '/onboarding'],
    ['staff with portal access', staffAndPortal, '/', '/patients'],
    ['staff with portal access', staffAndPortal, '/portal', '/portal'],
  ])('routes a user who is %s: %#', async (_kind, me, path, target) => {
    stubApi(me);

    const { router } = startApp(path);

    await expectLocation(router, target);
  });

  it('keeps the query string and the path when asking to sign in', async () => {
    stubApi(signedOut);

    const { router } = startApp(`/patients/${patient.id}?tab=history`);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(router.state.location.search).toEqual({
      redirect: `/patients/${patient.id}?tab=history`,
    });
  });

  it.each([['//evil.com'], ['https://evil.com'], ['/\\evil.com']])(
    'never gives the login page the redirect %s',
    async (target) => {
      stubApi(signedOut);

      const { router } = startApp(
        `/login?redirect=${encodeURIComponent(target)}`,
      );

      await screen.findByText(t.auth.title);
      // What `Route.useSearch()` returns to the login page.
      expect(router.state.matches.at(-1)?.search).toEqual({
        redirect: undefined,
      });
    },
  );

  it('shows the error page, not the app, when `me` fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(403, null))),
    );

    startApp('/patients');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.common.errorTitle,
    );
    expect(screen.queryByText(/Secreto/)).not.toBeInTheDocument();
  });

  it('sends the user to /login and clears the cache on a 401', async () => {
    stubApi(staff, 401);
    const { queryClient, router } = startApp('/patients');

    await expectLocation(router, '/login?redirect=%2Fpatients');

    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    });
    expect(queryClient.getQueryData(meQueryOptions().queryKey)).toBeNull();
  });

  it('keeps the redirect when a late 401 arrives at /login', async () => {
    stubApi(signedOut);
    const { queryClient, router } = startApp('/login?redirect=%2Fpatients');
    await expectLocation(router, '/login?redirect=%2Fpatients');
    queryClient.setQueryData(['patients'], [patient]);

    await act(() => handleUnauthorized(queryClient, router));

    await expectLocation(router, '/login?redirect=%2Fpatients');
    expect(queryClient.getQueryData(['patients'])).toBeUndefined();
  });

  it('clears cached patient data when `me` finds the session gone', async () => {
    const fetchMock = stubApi(staff);
    const { queryClient, router } = startApp('/patients');
    await screen.findByText(/Secreto/);

    fetchMock.mockImplementation(() => Promise.resolve(json(401, null)));
    await queryClient.invalidateQueries({
      queryKey: meQueryOptions().queryKey,
      refetchType: 'none',
    });
    await act(() => router.invalidate());

    await expectLocation(router, '/login?redirect=%2Fpatients');
    expect(queryClient.getQueryData(['patients'])).toBeUndefined();
  });
});
