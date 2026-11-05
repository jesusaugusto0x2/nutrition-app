import { PASSWORD_MIN_LENGTH } from '@nutri/schemas';
import { fireEvent, screen } from '@testing-library/react';
import { t } from '@/i18n';
import {
  bodiesOf,
  invalidToken,
  noContent,
  openApp,
  serverError,
  stubApi,
  throttled,
} from '../testing';

const TOKEN = 'emailed-token_123';
const RESET = '/api/auth/reset-password';
const PASSWORD = 'una frase larga y fácil';

const passwordField = () => screen.getByLabelText(t.resetPassword.password);
const confirmationField = () =>
  screen.getByLabelText(t.resetPassword.confirmation);

function submit(password = PASSWORD, confirmation = password) {
  fireEvent.change(passwordField(), { target: { value: password } });
  fireEvent.change(confirmationField(), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole('button', { name: t.resetPassword.submit }));
}

async function openResetPassword(url = `/reset-password?token=${TOKEN}`) {
  const opened = openApp(url, ['/login']);
  await screen.findByRole('heading', { name: t.resetPassword.title });
  return opened;
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes the token from the address bar without adding a history entry', async () => {
    stubApi({ [RESET]: noContent });
    const { history } = await openResetPassword();

    expect(history.location.pathname).toBe('/reset-password');
    expect(history.location.search).toBe('');
    expect(history.length).toBe(2);
  });

  it('asks the browser for a new password in both fields', async () => {
    stubApi({ [RESET]: noContent });
    await openResetPassword();

    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmationField()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('posts the token from the link with the new password, then confirms', async () => {
    const fetchMock = stubApi({ [RESET]: noContent });
    await openResetPassword();

    submit();

    expect(
      await screen.findByRole('heading', { name: t.resetPassword.doneTitle }),
    ).toHaveFocus();
    expect(bodiesOf(fetchMock, RESET)).toEqual([
      { token: TOKEN, password: PASSWORD },
    ]);
    expect(
      screen.getByRole('link', { name: t.resetPassword.signIn }),
    ).toHaveAttribute('href', '/login');
  });

  it('rejects a short password without calling the API', async () => {
    const fetchMock = stubApi({ [RESET]: noContent });
    await openResetPassword();

    submit('corta');

    expect(
      await screen.findByText(t.signUp.passwordTooShort(PASSWORD_MIN_LENGTH)),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, RESET)).toEqual([]);
  });

  it('rejects a confirmation that does not match', async () => {
    const fetchMock = stubApi({ [RESET]: noContent });
    await openResetPassword();

    submit(PASSWORD, `${PASSWORD}!`);

    expect(
      await screen.findByText(t.resetPassword.mismatch),
    ).toBeInTheDocument();
    expect(bodiesOf(fetchMock, RESET)).toEqual([]);
  });

  it('asks for the confirmation when it is empty', async () => {
    stubApi({ [RESET]: noContent });
    await openResetPassword();

    submit(PASSWORD, '');

    expect(
      await screen.findByText(t.resetPassword.confirmationRequired),
    ).toBeInTheDocument();
  });

  it('shows an expired link with a way to request a new one', async () => {
    stubApi({ [RESET]: invalidToken });
    await openResetPassword();

    submit();

    expect(
      await screen.findByRole('heading', { name: t.linkExpired.title }),
    ).toHaveFocus();
    expect(
      screen.getByRole('link', { name: t.linkExpired.requestNew }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('shows an expired link right away when there is no token', async () => {
    const fetchMock = stubApi({ [RESET]: noContent });
    openApp('/reset-password');

    await screen.findByRole('heading', { name: t.linkExpired.title });
    expect(bodiesOf(fetchMock, RESET)).toEqual([]);
  });

  it('keeps the form after a server error so the user can try again', async () => {
    let attempts = 0;
    const fetchMock = stubApi({
      [RESET]: () => (++attempts === 1 ? serverError() : noContent()),
    });
    await openResetPassword();

    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.resetPassword.failedBody,
    );
    fireEvent.click(
      screen.getByRole('button', { name: t.resetPassword.submit }),
    );

    await screen.findByRole('heading', { name: t.resetPassword.doneTitle });
    expect(bodiesOf(fetchMock, RESET)).toHaveLength(2);
  });

  it('says how long to wait when rate limited', async () => {
    stubApi({ [RESET]: () => throttled('60') });
    await openResetPassword();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.signUp.tooManyAttemptsBody(1),
    );
  });

  it('opens also for a signed-in user', async () => {
    stubApi({
      '/api/auth/me': () =>
        new Response(
          JSON.stringify({
            user: {
              id: '00000000-0000-4000-8000-000000000001',
              email: 'carmen@example.com',
              name: 'Carmen Rojas',
              emailVerified: true,
            },
            memberships: [],
            patientAccess: [],
          }),
          { status: 200 },
        ),
      [RESET]: noContent,
    });

    const { router } = await openResetPassword();
    expect(router.state.location.pathname).toBe('/reset-password');
  });
});
