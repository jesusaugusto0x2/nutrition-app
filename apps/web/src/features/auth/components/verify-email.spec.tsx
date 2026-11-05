import { fireEvent, screen, waitFor } from '@testing-library/react';
import { t } from '@/i18n';
import {
  accepted,
  bodiesOf,
  invalidToken,
  json,
  openApp,
  serverError,
  stubApi,
  throttled,
} from '../testing';

const TOKEN = 'emailed-token_123';
const VERIFY = '/api/auth/verify-email';
const RESEND = '/api/auth/resend-verification';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'carmen@example.com',
  name: 'Carmen Rojas',
  emailVerified: true,
};

/** A new account: no clinic yet, so home is onboarding. */
const newAccount = { user, memberships: [], patientAccess: [] };

/**
 * `me` answers "signed out" until the verification signs the user in, like
 * the session cookie would.
 */
function stubSignInOnVerify(verify: () => Response = () => json(200, user)) {
  let signedIn = false;
  return stubApi({
    '/api/auth/me': () =>
      signedIn
        ? json(200, newAccount)
        : json(401, { statusCode: 401, code: 'UNAUTHORIZED' }),
    [VERIFY]: () => {
      const response = verify();
      signedIn = response.ok;
      return response;
    },
    [RESEND]: accepted,
  });
}

describe('VerifyEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes the token from the address bar without adding a history entry', async () => {
    stubSignInOnVerify(serverError);
    const { history } = openApp(`/verify-email?token=${TOKEN}`, ['/login']);

    await screen.findByRole('heading', { name: t.verifyEmail.failedTitle });
    expect(history.location.pathname).toBe('/verify-email');
    expect(history.location.search).toBe('');
    expect(history.length).toBe(2);
  });

  it('posts the token once and goes to the home of the signed-in user', async () => {
    const fetchMock = stubSignInOnVerify();
    const { router } = openApp(`/verify-email?token=${TOKEN}`);

    await screen.findByRole('heading', { name: t.onboarding.title });
    expect(bodiesOf(fetchMock, VERIFY)).toEqual([{ token: TOKEN }]);
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('verifies the link also when someone is already signed in', async () => {
    const fetchMock = stubApi({
      '/api/auth/me': () => json(200, newAccount),
      [VERIFY]: () => json(200, user),
    });
    openApp(`/verify-email?token=${TOKEN}`);

    await screen.findByRole('heading', { name: t.onboarding.title });
    expect(bodiesOf(fetchMock, VERIFY)).toEqual([{ token: TOKEN }]);
  });

  it('shows an expired link when the API rejects the token', async () => {
    stubSignInOnVerify(invalidToken);
    openApp(`/verify-email?token=${TOKEN}`);

    expect(
      await screen.findByRole('heading', { name: t.linkExpired.title }),
    ).toHaveFocus();
    expect(screen.getByText(t.linkExpired.verifiedHint)).toBeInTheDocument();
  });

  it('shows an expired link without calling the API when there is no token', async () => {
    const fetchMock = stubSignInOnVerify();
    openApp('/verify-email');

    await screen.findByRole('heading', { name: t.linkExpired.title });
    expect(bodiesOf(fetchMock, VERIFY)).toEqual([]);
  });

  it('treats a malformed token as expired and still removes it', async () => {
    const fetchMock = stubSignInOnVerify();
    const { history } = openApp(`/verify-email?token=${'x'.repeat(300)}`);

    await screen.findByRole('heading', { name: t.linkExpired.title });
    expect(bodiesOf(fetchMock, VERIFY)).toEqual([]);
    expect(history.location.search).toBe('');
  });

  it('sends a new link from the expired page and shows check-your-email', async () => {
    const fetchMock = stubSignInOnVerify(invalidToken);
    openApp(`/verify-email?token=${TOKEN}`);
    await screen.findByRole('heading', { name: t.linkExpired.title });

    fireEvent.change(screen.getByLabelText(t.auth.email), {
      target: { value: ' Carmen@Example.com ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: t.verifyEmail.resendSubmit }),
    );

    await screen.findByRole('heading', { name: t.checkEmail.title });
    expect(screen.getByText('carmen@example.com')).toBeInTheDocument();
    expect(bodiesOf(fetchMock, RESEND)).toEqual([
      { email: 'carmen@example.com' },
    ]);
  });

  it('retries with the same token after a server error', async () => {
    let attempts = 0;
    const fetchMock = stubSignInOnVerify(() =>
      ++attempts === 1 ? serverError() : json(200, user),
    );
    openApp(`/verify-email?token=${TOKEN}`);

    expect(
      await screen.findByRole('heading', { name: t.verifyEmail.failedTitle }),
    ).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      t.verifyEmail.failedBody,
    );
    fireEvent.click(screen.getByRole('button', { name: t.common.retry }));

    await screen.findByRole('heading', { name: t.onboarding.title });
    expect(bodiesOf(fetchMock, VERIFY)).toEqual([
      { token: TOKEN },
      { token: TOKEN },
    ]);
  });

  it('says how long to wait when verifying is rate limited', async () => {
    stubSignInOnVerify(() => throttled('120'));
    openApp(`/verify-email?token=${TOKEN}`);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        t.signUp.tooManyAttemptsBody(2),
      ),
    );
  });
});
