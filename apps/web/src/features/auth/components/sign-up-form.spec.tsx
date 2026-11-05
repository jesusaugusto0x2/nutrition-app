import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@nutri/schemas';
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

const PASSWORD = 'una frase larga y fácil';

function json(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers });
}

function apiError(status: number, code: string) {
  return {
    statusCode: status,
    code,
    message: code,
    path: '/api/auth/sign-up',
    timestamp: '2026-01-01T10:00:00.000Z',
  };
}

const accepted = () => new Response(null, { status: 202 });
const throttled = (retryAfter?: string) =>
  json(
    429,
    apiError(429, 'TOO_MANY_REQUESTS'),
    retryAfter ? { 'Retry-After': retryAfter } : undefined,
  );

/** What `/api/auth/sign-up` and `/api/auth/resend-verification` answer. */
function stubApi({
  signUp = accepted,
  resend = accepted,
}: { signUp?: () => Response; resend?: () => Response } = {}) {
  const fetchMock = vi.fn((path: string) => {
    switch (path) {
      case '/api/auth/me':
        return Promise.resolve(json(401, apiError(401, 'UNAUTHORIZED')));
      case '/api/auth/sign-up':
        return Promise.resolve(signUp());
      case '/api/auth/resend-verification':
        return Promise.resolve(resend());
      default:
        return Promise.reject(new Error(`Unexpected request to ${path}`));
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodiesOf(fetchMock: ReturnType<typeof stubApi>, path: string) {
  return fetchMock.mock.calls
    .filter(([calledPath]) => calledPath === path)
    .map((call) => {
      const init = (call as unknown as [string, RequestInit])[1];
      return JSON.parse(init.body as string) as unknown;
    });
}

async function openSignUp() {
  const queryClient = createQueryClient(vi.fn());
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: ['/sign-up'] }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: t.signUp.title });
  return { router };
}

const nameField = () => screen.getByLabelText(t.signUp.name);
const emailField = () => screen.getByLabelText(t.auth.email);
const passwordField = () => screen.getByLabelText(t.auth.password);
const clinicField = () => screen.getByLabelText(t.signUp.clinicName);
const submitButton = () =>
  screen.getByRole('button', { name: t.signUp.submit });
const resendButton = () =>
  screen.getByRole('button', { name: t.checkEmail.resend });

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

function fillAndSubmit({
  name = ' Carmen Rojas ',
  email = 'Carmen@Example.com ',
  password = PASSWORD,
  clinicName = 'Nutrición Rojas',
} = {}) {
  type(nameField(), name);
  type(emailField(), email);
  type(passwordField(), password);
  type(clinicField(), clinicName);
  fireEvent.click(submitButton());
}

async function signUpAndWait() {
  fillAndSubmit();
  await screen.findByRole('heading', { name: t.checkEmail.title });
}

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks the browser for a new password and autofills the rest', async () => {
    stubApi();
    await openSignUp();

    expect(nameField()).toHaveAttribute('autocomplete', 'name');
    expect(emailField()).toHaveAttribute('autocomplete', 'email');
    expect(emailField()).toHaveAttribute('inputmode', 'email');
    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows the password requirement as a hint tied to the field', async () => {
    stubApi();
    await openSignUp();

    const hint = screen.getByText(
      t.signUp.passwordMinLength(PASSWORD_MIN_LENGTH),
    );
    expect(passwordField()).toHaveAccessibleDescription(
      expect.stringContaining(hint.textContent ?? ''),
    );
  });

  it('links back to the login page', async () => {
    stubApi();
    await openSignUp();

    expect(screen.getByRole('link', { name: t.signUp.signIn })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('shows Spanish field errors and posts nothing when they are empty', async () => {
    const fetchMock = stubApi();
    await openSignUp();

    fireEvent.click(submitButton());

    expect(await screen.findByText(t.signUp.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(t.auth.emailRequired)).toBeInTheDocument();
    expect(
      screen.getByText(t.signUp.passwordTooShort(PASSWORD_MIN_LENGTH)),
    ).toBeInTheDocument();
    expect(screen.getByText(t.signUp.clinicNameRequired)).toBeInTheDocument();
    expect(bodiesOf(fetchMock, '/api/auth/sign-up')).toEqual([]);
  });

  it('rejects a password one character shorter than the schema minimum', async () => {
    const fetchMock = stubApi();
    await openSignUp();

    fillAndSubmit({ password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1) });

    expect(
      await screen.findByText(t.signUp.passwordTooShort(PASSWORD_MIN_LENGTH)),
    ).toBeInTheDocument();
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(bodiesOf(fetchMock, '/api/auth/sign-up')).toEqual([]);
  });

  it('says how long a password may be when it is too long', async () => {
    stubApi();
    await openSignUp();

    fillAndSubmit({ password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1) });

    expect(
      await screen.findByText(t.signUp.tooLong(PASSWORD_MAX_LENGTH)),
    ).toBeInTheDocument();
  });

  it('rejects a malformed email', async () => {
    stubApi();
    await openSignUp();

    fillAndSubmit({ email: 'carmen@' });

    expect(await screen.findByText(t.auth.emailInvalid)).toBeInTheDocument();
  });

  it('posts trimmed names, the normalized email and an untouched password', async () => {
    const fetchMock = stubApi();
    await openSignUp();

    await signUpAndWait();

    expect(bodiesOf(fetchMock, '/api/auth/sign-up')).toEqual([
      {
        name: 'Carmen Rojas',
        email: 'carmen@example.com',
        password: PASSWORD,
        clinicName: 'Nutrición Rojas',
      },
    ]);
  });

  it('shows the check-your-email screen with the address after submitting', async () => {
    stubApi();
    await openSignUp();

    await signUpAndWait();

    const heading = screen.getByRole('heading', { name: t.checkEmail.title });
    expect(heading).toHaveFocus();
    expect(screen.getByText('carmen@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: t.checkEmail.backToSignIn }),
    ).toHaveAttribute('href', '/login');
  });

  it('goes back to the filled form to correct the email', async () => {
    stubApi();
    await openSignUp();
    await signUpAndWait();

    fireEvent.click(
      screen.getByRole('button', { name: t.checkEmail.wrongEmail }),
    );

    expect(
      await screen.findByRole('heading', { name: t.signUp.title }),
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue(' Carmen Rojas ');
    expect(emailField()).toHaveValue('Carmen@Example.com ');
    await waitFor(() => expect(emailField()).toHaveFocus());
  });

  it('says when to try again while sign-up is rate limited', async () => {
    stubApi({ signUp: () => throttled('600') });
    await openSignUp();

    fillAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.auth.tooManyAttemptsTitle);
    expect(alert).toHaveTextContent(t.signUp.tooManyAttemptsBody(10));
    expect(screen.queryByText(t.checkEmail.title)).not.toBeInTheDocument();
  });

  it('shows a generic error when the API fails', async () => {
    stubApi({ signUp: () => json(500, apiError(500, 'INTERNAL_ERROR')) });
    await openSignUp();

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.signUp.failedBody,
    );
  });

  describe('resending the link', () => {
    it('resends to the normalized address and waits before the next one', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetchMock = stubApi();
      await openSignUp();
      await signUpAndWait();

      fireEvent.click(resendButton());

      expect(await screen.findByText(t.checkEmail.resent)).toBeInTheDocument();
      expect(bodiesOf(fetchMock, '/api/auth/resend-verification')).toEqual([
        { email: 'carmen@example.com' },
      ]);
      expect(
        screen.getByRole('button', { name: t.checkEmail.resendIn('1:00') }),
      ).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(61_000);
      });

      expect(resendButton()).toBeEnabled();
    });

    it('says when another link can be sent while rate limited', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      stubApi({ resend: () => throttled('300') });
      await openSignUp();
      await signUpAndWait();

      fireEvent.click(resendButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        t.checkEmail.resendThrottled(5),
      );
      expect(
        screen.getByRole('button', { name: t.checkEmail.resendIn('5:00') }),
      ).toBeDisabled();
    });

    it('does not block the button without a Retry-After header', async () => {
      stubApi({ resend: () => throttled() });
      await openSignUp();
      await signUpAndWait();

      fireEvent.click(resendButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        t.checkEmail.resendThrottledLater,
      );
      expect(resendButton()).toBeEnabled();
    });

    it('says so when resending fails', async () => {
      stubApi({ resend: () => json(500, apiError(500, 'INTERNAL_ERROR')) });
      await openSignUp();
      await signUpAndWait();

      fireEvent.click(resendButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        t.auth.resendFailed,
      );
      expect(resendButton()).toBeEnabled();
    });
  });
});
