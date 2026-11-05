import { Link, useRouter } from '@tanstack/react-router';
import { MailIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import {
  isInvalidLinkToken,
  useResendVerification,
  useVerifyEmail,
} from '../api';
import { CheckEmail } from './check-email';
import { EmailLinkForm } from './email-link-form';
import { LinkExpired } from './link-expired';
import { type RequestFailure, readRequestFailure } from './request-failure';

type State =
  | { kind: 'verifying' }
  /** Network, server or rate limit: the same token may work on retry. */
  | { kind: 'failed'; failure: RequestFailure }
  | { kind: 'expired'; cameBack?: boolean }
  | { kind: 'sent'; email: string };

const headingClass =
  'm-0 font-heading text-display font-medium outline-none lg:text-[40px] lg:leading-[1.1]';

/**
 * Posts the token of the emailed link as soon as the page opens; the API
 * signs the user in, and the page goes home. Never a GET: link previews would
 * consume the token (see the API's `verify-email`).
 */
export function VerifyEmail({ token }: { token: string | null }) {
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const router = useRouter();
  const [state, setState] = useState<State>(() =>
    token ? { kind: 'verifying' } : { kind: 'expired' },
  );
  /*
   * The token works once: a second request (Strict Mode runs effects twice)
   * would fail and show the expired page after a success.
   */
  const started = useRef(false);
  const failedHeading = useRef<HTMLHeadingElement>(null);

  const { mutateAsync } = verify;
  const submit = useCallback(
    async (linkToken: string) => {
      setState({ kind: 'verifying' });
      try {
        await mutateAsync({ token: linkToken });
      } catch (error) {
        setState(
          isInvalidLinkToken(error)
            ? { kind: 'expired' }
            : { kind: 'failed', failure: readRequestFailure(error) },
        );
        return;
      }
      // Home depends on the account: the index route reads `me` and decides.
      await router.navigate({ to: '/', replace: true });
    },
    [mutateAsync, router],
  );

  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      void submit(token);
    }
  }, [token, submit]);

  useEffect(() => {
    if (state.kind === 'failed') {
      failedHeading.current?.focus();
    }
  }, [state.kind]);

  switch (state.kind) {
    case 'verifying':
      return (
        <div role="status" className="flex flex-col gap-6">
          <span className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MailIcon aria-hidden className="size-10" strokeWidth={1.8} />
          </span>
          <h1 className={headingClass}>{t.verifyEmail.verifying}</h1>
        </div>
      );

    case 'failed':
      return (
        <div className="flex flex-1 flex-col gap-6">
          <header className="flex flex-col gap-2.5">
            <h1 ref={failedHeading} tabIndex={-1} className={headingClass}>
              {t.verifyEmail.failedTitle}
            </h1>
            <p role="alert" className="m-0">
              {state.failure.kind === 'unknown'
                ? t.verifyEmail.failedBody
                : state.failure.minutes === null
                  ? t.signUp.tooManyAttemptsLater
                  : t.signUp.tooManyAttemptsBody(state.failure.minutes)}
            </p>
          </header>
          <Button
            size="lg"
            fullWidth
            onClick={() => token && void submit(token)}
          >
            {t.common.retry}
          </Button>
          <footer className="mt-auto border-t pt-5 text-center lg:mt-0 lg:text-left">
            <Link to="/login" className="font-bold">
              {t.checkEmail.backToSignIn}
            </Link>
          </footer>
        </div>
      );

    case 'expired':
      return (
        <LinkExpired hint={t.linkExpired.verifiedHint}>
          <div className="flex flex-col gap-5">
            <p className="m-0 text-muted-foreground">
              {t.verifyEmail.resendHint}
            </p>
            <EmailLinkForm
              submitLabel={t.verifyEmail.resendSubmit}
              unknownBody={t.auth.resendFailed}
              send={(email) => resend.mutateAsync({ email })}
              onSent={(email) => setState({ kind: 'sent', email })}
              focusOnMount={state.cameBack}
            />
          </div>
        </LinkExpired>
      );

    case 'sent':
      return (
        <CheckEmail
          email={state.email}
          onChangeEmail={() => setState({ kind: 'expired', cameBack: true })}
        />
      );
  }
}
