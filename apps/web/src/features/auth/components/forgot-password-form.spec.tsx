import { fireEvent, screen } from '@testing-library/react';
import { t } from '@/i18n';
import {
  accepted,
  bodiesOf,
  openApp,
  serverError,
  stubApi,
  throttled,
} from '../testing';

const FORGOT = '/api/auth/forgot-password';

const emailField = () => screen.getByLabelText(t.auth.email);

function submit(email: string) {
  fireEvent.change(emailField(), { target: { value: email } });
  fireEvent.click(
    screen.getByRole('button', { name: t.forgotPassword.submit }),
  );
}

async function openForgotPassword() {
  const opened = openApp('/forgot-password');
  await screen.findByRole('heading', { name: t.forgotPassword.title });
  return opened;
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is reachable from the login page', async () => {
    stubApi({ [FORGOT]: accepted });
    openApp('/login');

    fireEvent.click(
      await screen.findByRole('link', { name: t.auth.forgotPassword }),
    );

    await screen.findByRole('heading', { name: t.forgotPassword.title });
  });

  it('sends the normalized email and shows the same confirmation for any email', async () => {
    const fetchMock = stubApi({ [FORGOT]: accepted });
    await openForgotPassword();

    submit(' Carmen@Example.com ');

    await screen.findByRole('heading', { name: t.checkEmail.resetTitle });
    expect(screen.getByText('carmen@example.com')).toBeInTheDocument();
    expect(screen.getByText(t.checkEmail.resetExpires)).toBeInTheDocument();
    expect(bodiesOf(fetchMock, FORGOT)).toEqual([
      { email: 'carmen@example.com' },
    ]);
  });

  it('asks for a valid email without calling the API', async () => {
    const fetchMock = stubApi({ [FORGOT]: accepted });
    await openForgotPassword();

    submit('');
    expect(await screen.findByText(t.auth.emailRequired)).toBeInTheDocument();

    submit('carmen');
    expect(await screen.findByText(t.auth.emailInvalid)).toBeInTheDocument();
    expect(bodiesOf(fetchMock, FORGOT)).toEqual([]);
  });

  it('resends the link from the confirmation', async () => {
    const fetchMock = stubApi({ [FORGOT]: accepted });
    await openForgotPassword();
    submit('carmen@example.com');
    await screen.findByRole('heading', { name: t.checkEmail.resetTitle });

    fireEvent.click(screen.getByRole('button', { name: t.checkEmail.resend }));

    await screen.findByText(t.checkEmail.resent);
    expect(bodiesOf(fetchMock, FORGOT)).toHaveLength(2);
  });

  it('goes back to the form to use another email', async () => {
    stubApi({ [FORGOT]: accepted });
    await openForgotPassword();
    submit('carmen@example.com');
    await screen.findByRole('heading', { name: t.checkEmail.resetTitle });

    fireEvent.click(
      screen.getByRole('button', { name: t.checkEmail.otherEmail }),
    );

    await screen.findByRole('heading', { name: t.forgotPassword.title });
    expect(emailField()).toHaveFocus();
  });

  it('says how long to wait when rate limited', async () => {
    stubApi({ [FORGOT]: () => throttled('300') });
    await openForgotPassword();

    submit('carmen@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.signUp.tooManyAttemptsBody(5),
    );
  });

  it('shows an error when the request fails', async () => {
    stubApi({ [FORGOT]: serverError });
    await openForgotPassword();

    submit('carmen@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.forgotPassword.failedBody,
    );
  });
});
