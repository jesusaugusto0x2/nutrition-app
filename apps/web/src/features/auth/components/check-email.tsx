import { Link } from '@tanstack/react-router';
import { MailIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SuccessNotice } from '@/components/ui/notice';
import { t } from '@/i18n';
import { formatCountdown } from '@/lib/format';
import { useResendVerification } from '../api';
import { readThrottle } from '../throttle';
import { useSecondsUntil } from '../use-seconds-until';

/**
 * Wait after each resent link before offering another. The API allows 3 per
 * email every 15 minutes; this keeps a double tap from spending them.
 */
export const RESEND_COOLDOWN_MS = 60_000;

type Outcome =
  | { kind: 'sent' }
  | { kind: 'throttled'; minutes: number | null }
  | { kind: 'failed' };

function OutcomeMessage({ outcome }: { outcome: Outcome }) {
  switch (outcome.kind) {
    case 'sent':
      return <SuccessNotice>{t.checkEmail.resent}</SuccessNotice>;
    case 'throttled':
    case 'failed':
      return (
        <p role="alert" className="m-0 text-meta font-bold text-error">
          {outcome.kind === 'failed'
            ? t.auth.resendFailed
            : outcome.minutes === null
              ? t.checkEmail.resendThrottledLater
              : t.checkEmail.resendThrottled(outcome.minutes)}
        </p>
      );
  }
}

/**
 * Shown after a sign-up request. It says the same whether or not the email
 * already had an account, as the API does.
 */
export function CheckEmail({
  email,
  onChangeEmail,
}: {
  /** As the API received it: normalized. */
  email: string;
  /** Back to the form, with what the user typed. */
  onChangeEmail: () => void;
}) {
  const resend = useResendVerification();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const secondsLeft = useSecondsUntil(retryAt);
  const heading = useRef<HTMLHeadingElement>(null);

  // The form this replaces had focus; screen readers start over from here.
  useEffect(() => heading.current?.focus(), []);

  const onResend = async () => {
    setOutcome(null);
    try {
      await resend.mutateAsync({ email });
      setOutcome({ kind: 'sent' });
      setRetryAt(Date.now() + RESEND_COOLDOWN_MS);
    } catch (error) {
      const throttle = readThrottle(error);
      if (throttle) {
        setOutcome({ kind: 'throttled', minutes: throttle.minutes });
        setRetryAt(throttle.retryAt);
      } else {
        setOutcome({ kind: 'failed' });
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
        <MailIcon aria-hidden className="size-10" strokeWidth={1.8} />
      </span>

      <header className="flex flex-col gap-2.5">
        <h1
          ref={heading}
          tabIndex={-1}
          className="m-0 font-heading text-display font-medium outline-none lg:text-[40px] lg:leading-[1.1]"
        >
          {t.checkEmail.title}
        </h1>
        <p className="m-0">
          {t.checkEmail.sentTo} <strong className="break-all">{email}</strong>.{' '}
          {t.checkEmail.openIt}
        </p>
      </header>

      <ul className="m-0 flex list-none flex-col gap-2 rounded-card border bg-surface px-[18px] py-4 text-muted-foreground">
        <li>{t.checkEmail.expires}</li>
        <li>{t.checkEmail.spam}</li>
      </ul>

      {outcome && <OutcomeMessage outcome={outcome} />}

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5">
        <Button
          variant="secondary"
          size="md"
          className="w-full text-primary lg:w-auto"
          disabled={secondsLeft > 0 || resend.isPending}
          onClick={() => void onResend()}
        >
          {secondsLeft > 0
            ? t.checkEmail.resendIn(formatCountdown(secondsLeft))
            : t.checkEmail.resend}
        </Button>
        <Button
          variant="text"
          className="self-center font-bold lg:self-auto"
          onClick={onChangeEmail}
        >
          {t.checkEmail.wrongEmail}
        </Button>
      </div>

      <footer className="mt-auto border-t pt-5 text-center lg:mt-0 lg:text-left">
        <Link to="/login" className="font-bold">
          {t.checkEmail.backToSignIn}
        </Link>
      </footer>
    </div>
  );
}
