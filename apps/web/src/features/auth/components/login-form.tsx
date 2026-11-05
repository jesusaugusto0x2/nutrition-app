import { zodResolver } from '@hookform/resolvers/zod';
import { type SignIn, signInSchema } from '@nutri/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { LockIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FormAlert, SuccessNotice } from '@/components/ui/notice';
import { OrSeparator } from '@/components/ui/or-separator';
import { PasswordInput } from '@/components/ui/password-input';
import { t } from '@/i18n';
import { ApiClientError } from '@/lib/api-client';
import { formatCountdown } from '@/lib/format';
import {
  FORGOT_PASSWORD_PATH,
  meQueryOptions,
  useResendVerification,
  useSignIn,
} from '../api';
import { homePath } from '../home-path';
import type { LoginSearch } from '../redirect';
import { readThrottle } from '../throttle';
import { useSecondsUntil } from '../use-seconds-until';
import { GoogleButton } from './google-button';

type Failure =
  | { kind: 'credentials' }
  /** Both `null` without a `Retry-After`; `retryAt` is epoch milliseconds. */
  | { kind: 'throttled'; retryAt: number | null; minutes: number | null }
  | { kind: 'unverified'; email: string }
  | { kind: 'unknown' };

function toFailure(error: unknown, email: string): Failure {
  const throttle = readThrottle(error);
  if (throttle) {
    return { kind: 'throttled', ...throttle };
  }
  if (!(error instanceof ApiClientError)) {
    return { kind: 'unknown' };
  }
  switch (error.body?.code) {
    case 'INVALID_CREDENTIALS':
      return { kind: 'credentials' };
    case 'EMAIL_NOT_VERIFIED':
      return { kind: 'unverified', email };
    default:
      return { kind: 'unknown' };
  }
}

function UnverifiedAlert({ email }: { email: string }) {
  const resend = useResendVerification();

  return (
    <>
      <FormAlert
        title={t.auth.emailNotVerifiedTitle}
        action={
          !resend.isSuccess && (
            <Button
              variant="secondary"
              size="sm"
              disabled={resend.isPending}
              onClick={() => resend.mutate({ email })}
            >
              {t.auth.resendEmail}
            </Button>
          )
        }
      >
        {t.auth.emailNotVerifiedBody}
      </FormAlert>
      {resend.isSuccess && <SuccessNotice>{t.auth.emailResent}</SuccessNotice>}
      {resend.isError && (
        <p role="alert" className="m-0 text-meta font-bold text-error">
          {t.auth.resendFailed}
        </p>
      )}
    </>
  );
}

/** `minutes` stays fixed: the alert is announced again on every change. */
function ThrottledAlert({ minutes }: { minutes: number | null }) {
  return (
    <FormAlert
      icon={LockIcon}
      title={t.auth.tooManyAttemptsTitle}
      action={
        <a href={FORGOT_PASSWORD_PATH} className="font-bold">
          {t.auth.createNewPassword}
        </a>
      }
    >
      {minutes === null
        ? t.auth.tooManyAttemptsLater
        : t.auth.tooManyAttemptsBody(minutes)}
    </FormAlert>
  );
}

function FailureAlert({ failure }: { failure: Failure }) {
  switch (failure.kind) {
    case 'credentials':
      return (
        <FormAlert title={t.auth.invalidCredentialsTitle}>
          {t.auth.invalidCredentialsBody}
        </FormAlert>
      );
    case 'throttled':
      return <ThrottledAlert minutes={failure.minutes} />;
    case 'unverified':
      return <UnverifiedAlert email={failure.email} />;
    case 'unknown':
      return (
        <FormAlert title={t.common.errorTitle}>
          {t.auth.signInFailedBody}
        </FormAlert>
      );
  }
}

/**
 * `redirect` and `error` come from `validateLoginSearch`. A Google failure
 * does not carry `redirect`: the API sends a successful Google sign-in to `/`.
 */
export function LoginForm({ redirect, error }: LoginSearch) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const signIn = useSignIn();
  const [failure, setFailure] = useState<Failure | null>(null);
  /** Shown until the user tries again with their email. */
  const [googleFailed, setGoogleFailed] = useState(error === 'google');
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const retryAt = failure?.kind === 'throttled' ? failure.retryAt : null;
  const secondsLeft = useSecondsUntil(retryAt);
  const locked = secondsLeft > 0;
  // A countdown that ended has nothing left to say.
  const shownFailure = retryAt !== null && !locked ? null : failure;

  const onSubmit = async (values: SignIn) => {
    setFailure(null);
    setGoogleFailed(false);
    try {
      await signIn.mutateAsync(values);
      const me = await queryClient.fetchQuery(meQueryOptions());
      if (!me) {
        throw new Error('Signed in without a session');
      }
      // `history`, not `navigate`: `redirect` may carry a query string.
      router.history.push(redirect ?? homePath(me));
    } catch (error) {
      setFailure(toFailure(error, values.email));
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 font-heading text-display font-medium lg:text-[40px] lg:leading-[1.1]">
          {t.auth.title}
        </h1>
        <p className="m-0 text-muted-foreground">{t.auth.subtitle}</p>
      </header>

      {shownFailure && <FailureAlert failure={shownFailure} />}
      {googleFailed && (
        <FormAlert title={t.google.failedTitle}>
          {t.google.failedBody}
        </FormAlert>
      )}

      <GoogleButton />
      <OrSeparator>{t.google.orWithEmail}</OrSeparator>

      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-[18px]"
      >
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.auth.email}
              error={
                fieldState.error &&
                (field.value.trim()
                  ? t.auth.emailInvalid
                  : t.auth.emailRequired)
              }
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  {...field}
                  // The limit counts per email: another one may go through.
                  onChange={(event) => {
                    field.onChange(event);
                    if (failure?.kind === 'throttled') {
                      setFailure(null);
                    }
                  }}
                  size="lg"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t.auth.emailPlaceholder}
                />
              )}
            </FormField>
          )}
        />

        <div className="flex flex-col gap-1">
          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label={t.auth.password}
                error={fieldState.error && t.auth.passwordRequired}
              >
                {(controlProps) => (
                  <PasswordInput
                    {...controlProps}
                    {...field}
                    disabled={locked}
                    autoComplete="current-password"
                  />
                )}
              </FormField>
            )}
          />
          <a
            href={FORGOT_PASSWORD_PATH}
            className="flex min-h-touch items-center self-end font-bold"
          >
            {t.auth.forgotPassword}
          </a>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={locked || formState.isSubmitting}
        >
          {locked
            ? t.auth.submitLocked(formatCountdown(secondsLeft))
            : t.auth.submit}
        </Button>
      </form>

      <footer className="mt-auto flex flex-col gap-3 border-t pt-5 text-center lg:mt-0">
        <span>
          {t.auth.noAccount}{' '}
          <Link to="/sign-up" className="font-bold">
            {t.auth.createAccount}
          </Link>
        </span>
        <span className="text-meta text-muted-foreground">
          {t.auth.patientHint}
        </span>
      </footer>
    </div>
  );
}
