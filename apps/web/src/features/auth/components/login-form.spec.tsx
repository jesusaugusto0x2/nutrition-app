import type { AuthMe, Patient } from '@nutri/schemas';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { t } from '@/i18n';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@example.com',
  name: 'Ana',
  emailVerified: true,
};
const staff: AuthMe = {
  user,
  memberships: [
    {
      clinicId: '00000000-0000-4000-8000-000000000002',
      clinicName: 'Consultorio',
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
      firstName: 'Ana',
      lastName: 'Pérez',
      relationship: 'self',
    },
  ],
};
const patient: Patient = {
  id: '00000000-0000-4000-8000-000000000003',
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: '1990-05-10',
  sex: 'female',
  phone: null,
  address: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function json(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers });
}

function apiError(status: number, code: string) {
  return {
    statusCode: status,
    code,
    message: code,
    path: '/api/auth/sign-in',
    timestamp: '2026-01-01T10:00:00.000Z',
  };
}

/** What `/api/auth/sign-in` answers; `me` is what follows a success. */
function stubApi(
  signIn: () => Response,
  { me = staff, resend }: { me?: AuthMe; resend?: () => Response } = {},
) {
  let signedIn = false;
  const fetchMock = vi.fn((path: string) => {
    switch (path) {
      case '/api/auth/me':
        return Promise.resolve(
          signedIn ? json(200, me) : json(401, apiError(401, 'UNAUTHORIZED')),
        );
      case '/api/auth/sign-in': {
        const response = signIn();
        signedIn = response.ok;
        return Promise.resolve(response);
      }
      case '/api/auth/resend-verification':
        return Promise.resolve(
          resend?.() ?? new Response(null, { status: 202 }),
        );
      default:
        return Promise.resolve(json(200, [patient]));
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof stubApi>, path: string) {
  const call = fetchMock.mock.calls.find(([calledPath]) => calledPath === path);
  const init = (call as unknown as [string, RequestInit] | undefined)?.[1];
  return init?.body;
}

async function openLogin(path = '/login') {
  const onUnauthorized = vi.fn();
  const queryClient = createQueryClient(onUnauthorized);
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [path] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: t.auth.title });
  return { router, onUnauthorized };
}

const emailField = () => screen.getByLabelText(t.auth.email);
const passwordField = () => screen.getByLabelText(t.auth.password);
const submitButton = () => screen.getByRole('button', { name: t.auth.submit });

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

function submit(email = 'Ana@Example.com ') {
  type(emailField(), email);
  type(passwordField(), 'clave correcta');
  fireEvent.click(submitButton());
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks for the fields the browser needs to autofill on a phone', async () => {
    stubApi(() => json(200, user));
    await openLogin();

    expect(emailField()).toHaveAttribute('autocomplete', 'email');
    expect(emailField()).toHaveAttribute('inputmode', 'email');
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password');
  });

  it('links to the password recovery and sign-up pages', async () => {
    stubApi(() => json(200, user));
    await openLogin();

    expect(
      screen.getByRole('link', { name: t.auth.forgotPassword }),
    ).toHaveAttribute('href', '/forgot-password');
    expect(
      screen.getByRole('link', { name: t.auth.createAccount }),
    ).toHaveAttribute('href', '/sign-up');
  });

  it('shows Spanish field errors and posts nothing when they are empty', async () => {
    const fetchMock = stubApi(() => json(200, user));
    await openLogin();

    fireEvent.click(submitButton());

    expect(await screen.findByText(t.auth.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(t.auth.passwordRequired)).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/api/auth/sign-in')).toBeUndefined();
  });

  it('rejects a malformed email', async () => {
    stubApi(() => json(200, user));
    await openLogin();

    type(emailField(), 'ana@');
    fireEvent.click(submitButton());

    expect(await screen.findByText(t.auth.emailInvalid)).toBeInTheDocument();
  });

  it('posts the normalized email and an untouched password', async () => {
    const fetchMock = stubApi(() => json(200, user));
    await openLogin();

    submit();

    await waitFor(() => {
      expect(bodyOf(fetchMock, '/api/auth/sign-in')).toBe(
        '{"email":"ana@example.com","password":"clave correcta"}',
      );
    });
  });

  it("goes to the user's home after signing in", async () => {
    stubApi(() => json(200, user), { me: portalUser });
    const { router } = await openLogin();

    submit();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/portal');
    });
  });

  it('goes to the redirect param, query string included', async () => {
    stubApi(() => json(200, user));
    const target = `/patients/${patient.id}?tab=history`;
    const { router } = await openLogin(
      `/login?redirect=${encodeURIComponent(target)}`,
    );

    submit();

    await waitFor(() => {
      expect(router.state.location.href).toBe(target);
    });
  });

  it('ignores a redirect that leaves the app', async () => {
    stubApi(() => json(200, user));
    const { router } = await openLogin(
      `/login?redirect=${encodeURIComponent('//evil.com')}`,
    );

    submit();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patients');
    });
  });

  it('shows one generic message for wrong credentials', async () => {
    stubApi(() => json(401, apiError(401, 'INVALID_CREDENTIALS')));
    const { router, onUnauthorized } = await openLogin();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.auth.invalidCredentialsTitle,
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('blocks the password and counts down while rate limited', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubApi(() =>
      json(429, apiError(429, 'TOO_MANY_REQUESTS'), { 'Retry-After': '872' }),
    );
    await openLogin();
    // Time spent on the page must not count towards the wait.
    vi.advanceTimersByTime(120_000);

    submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.auth.tooManyAttemptsBody(15));
    expect(passwordField()).toBeDisabled();
    expect(
      screen.getByRole('button', { name: t.auth.submitLocked('14:32') }),
    ).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(
      screen.getByRole('button', { name: t.auth.submitLocked('13:32') }),
    ).toBeDisabled();
    // Text inside an alert is read aloud whenever it changes.
    expect(screen.getByRole('alert')).toHaveTextContent(
      t.auth.tooManyAttemptsBody(15),
    );
  });

  it('offers a new password while rate limited', async () => {
    stubApi(() =>
      json(429, apiError(429, 'TOO_MANY_REQUESTS'), { 'Retry-After': '60' }),
    );
    await openLogin();

    submit();

    expect(
      await screen.findByRole('link', { name: t.auth.createNewPassword }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('unlocks the form when the wait ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubApi(() =>
      json(429, apiError(429, 'TOO_MANY_REQUESTS'), { 'Retry-After': '30' }),
    );
    await openLogin();
    submit();
    await screen.findByRole('alert');

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(passwordField()).toBeEnabled();
    expect(submitButton()).toBeEnabled();
  });

  it('unlocks the form when the email changes', async () => {
    stubApi(() =>
      json(429, apiError(429, 'TOO_MANY_REQUESTS'), { 'Retry-After': '900' }),
    );
    await openLogin();
    submit();
    await screen.findByRole('alert');

    type(emailField(), 'otra@example.com');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(passwordField()).toBeEnabled();
    expect(submitButton()).toBeEnabled();
  });

  it('does not block the form without a Retry-After header', async () => {
    stubApi(() => json(429, apiError(429, 'TOO_MANY_REQUESTS')));
    await openLogin();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.auth.tooManyAttemptsLater,
    );
    expect(passwordField()).toBeEnabled();
    expect(submitButton()).toBeEnabled();
  });

  it('resends the verification email to the normalized address', async () => {
    const fetchMock = stubApi(() =>
      json(403, apiError(403, 'EMAIL_NOT_VERIFIED')),
    );
    await openLogin();

    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.auth.emailNotVerifiedTitle,
    );
    fireEvent.click(screen.getByRole('button', { name: t.auth.resendEmail }));

    expect(await screen.findByText(t.auth.emailResent)).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/api/auth/resend-verification')).toBe(
      '{"email":"ana@example.com"}',
    );
    expect(
      screen.queryByRole('button', { name: t.auth.resendEmail }),
    ).not.toBeInTheDocument();
  });

  it('says so when resending the email fails', async () => {
    stubApi(() => json(403, apiError(403, 'EMAIL_NOT_VERIFIED')), {
      resend: () => json(429, apiError(429, 'TOO_MANY_REQUESTS')),
    });
    await openLogin();

    submit();
    fireEvent.click(
      await screen.findByRole('button', { name: t.auth.resendEmail }),
    );

    expect(await screen.findByText(t.auth.resendFailed)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.auth.resendEmail }),
    ).toBeEnabled();
  });

  it('shows a generic error when the API fails', async () => {
    stubApi(() => json(500, apiError(500, 'INTERNAL_ERROR')));
    await openLogin();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.auth.signInFailedBody,
    );
  });

  it('shows a generic error when the network fails', async () => {
    stubApi(() => {
      throw new TypeError('Failed to fetch');
    });
    await openLogin();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.auth.signInFailedBody,
    );
  });

  it('clears the previous error on a new attempt', async () => {
    const responses = [
      json(401, apiError(401, 'INVALID_CREDENTIALS')),
      json(200, user),
    ];
    stubApi(() => responses.shift() as Response);
    const { router } = await openLogin();

    submit();
    await screen.findByRole('alert');
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patients');
    });
  });
});
