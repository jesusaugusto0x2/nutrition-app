import { type AuthMe, SIGN_UP_NAME_MAX_LENGTH } from '@nutri/schemas';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { t } from '@/i18n';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'carmen@gmail.com',
  name: 'Carmen Rojas',
  emailVerified: true,
};
const noAccount: AuthMe = { user, memberships: [], patientAccess: [] };
const staff: AuthMe = {
  user,
  memberships: [
    {
      clinicId: '00000000-0000-4000-8000-000000000002',
      clinicName: 'Nutrición Rojas',
      role: 'owner',
    },
  ],
  patientAccess: [],
};
const portalUser: AuthMe = {
  user,
  memberships: [],
  patientAccess: [
    {
      patientId: '00000000-0000-4000-8000-000000000003',
      firstName: 'Carmen',
      lastName: 'Rojas',
      relationship: 'self',
    },
  ],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function apiError(status: number, code: string) {
  return {
    statusCode: status,
    code,
    message: code,
    path: '/api/auth/onboarding',
    timestamp: '2026-01-01T10:00:00.000Z',
  };
}

const noContent = () => new Response(null, { status: 204 });

/**
 * `onboarding` is what the API answers; `meAfter` is who the user is once it
 * answered (a 409 means someone else already gave them an account).
 */
function stubApi({
  onboarding = noContent,
  meAfter = staff,
  signOut = noContent,
}: {
  onboarding?: () => Response;
  meAfter?: AuthMe;
  signOut?: () => Response;
} = {}) {
  let me: AuthMe | null = noAccount;
  const fetchMock = vi.fn((path: string) => {
    switch (path) {
      case '/api/auth/me':
        return Promise.resolve(
          me ? json(200, me) : json(401, apiError(401, 'UNAUTHORIZED')),
        );
      case '/api/auth/onboarding': {
        const response = onboarding();
        if (response.ok || response.status === 409) {
          me = meAfter;
        }
        return Promise.resolve(response);
      }
      case '/api/auth/sign-out': {
        const response = signOut();
        if (response.ok) {
          me = null;
        }
        return Promise.resolve(response);
      }
      default:
        return Promise.resolve(json(200, []));
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodiesOf(fetchMock: ReturnType<typeof stubApi>, path: string) {
  return fetchMock.mock.calls
    .filter(([calledPath]) => calledPath === path)
    .map((call) => (call as unknown as [string, RequestInit])[1].body);
}

async function openOnboarding() {
  const queryClient = createQueryClient(vi.fn());
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: ['/onboarding'] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: t.onboarding.title });
  return { router };
}

const clinicField = () => screen.getByLabelText(t.signUp.clinicName);
const submitButton = () =>
  screen.getByRole('button', { name: t.onboarding.submit });

function submit(clinicName: string) {
  fireEvent.change(clinicField(), { target: { value: clinicName } });
  fireEvent.click(submitButton());
}

describe('OnboardingForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the clinic name and says who will see it', async () => {
    stubApi();
    await openOnboarding();

    expect(clinicField()).toHaveAttribute('autocomplete', 'organization');
    expect(clinicField()).toHaveAccessibleDescription(t.signUp.clinicNameHelp);
  });

  it('shows a Spanish error and posts nothing when the name is empty', async () => {
    const fetchMock = stubApi();
    await openOnboarding();

    submit('   ');

    expect(
      await screen.findByText(t.signUp.clinicNameRequired),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, '/api/auth/onboarding')).toEqual([]);
  });

  it('says how long the name may be when it is too long', async () => {
    const fetchMock = stubApi();
    await openOnboarding();

    submit('a'.repeat(SIGN_UP_NAME_MAX_LENGTH + 1));

    expect(
      await screen.findByText(t.signUp.tooLong(SIGN_UP_NAME_MAX_LENGTH)),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, '/api/auth/onboarding')).toEqual([]);
  });

  it('creates the clinic with the trimmed name and goes to the patients', async () => {
    const fetchMock = stubApi();
    const { router } = await openOnboarding();

    submit('  Nutrición Rojas ');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patients');
    });
    expect(bodiesOf(fetchMock, '/api/auth/onboarding')).toEqual([
      '{"clinicName":"Nutrición Rojas"}',
    ]);
  });

  it('goes home when the account no longer needs onboarding', async () => {
    stubApi({
      onboarding: () => json(409, apiError(409, 'CONFLICT')),
      meAfter: portalUser,
    });
    const { router } = await openOnboarding();

    submit('Nutrición Rojas');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/portal');
    });
  });

  it('stays on the page with a generic error when the API fails', async () => {
    stubApi({ onboarding: () => json(500, apiError(500, 'INTERNAL')) });
    const { router } = await openOnboarding();

    submit('Nutrición Rojas');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.onboarding.failedBody,
    );
    expect(router.state.location.pathname).toBe('/onboarding');
    expect(submitButton()).toBeEnabled();
  });

  it('signs out to the login page', async () => {
    const fetchMock = stubApi();
    const { router } = await openOnboarding();

    fireEvent.click(screen.getByRole('button', { name: t.onboarding.signOut }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(bodiesOf(fetchMock, '/api/auth/sign-out')).toHaveLength(1);
  });

  it('stays signed in and says so when signing out fails', async () => {
    stubApi({ signOut: () => json(500, apiError(500, 'INTERNAL')) });
    const { router } = await openOnboarding();

    fireEvent.click(screen.getByRole('button', { name: t.onboarding.signOut }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.onboarding.signOutFailed,
    );
    expect(router.state.location.pathname).toBe('/onboarding');
  });
});
