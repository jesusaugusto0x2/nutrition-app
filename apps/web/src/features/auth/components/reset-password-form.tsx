import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@nutri/schemas';
import { Link } from '@tanstack/react-router';
import { CheckIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/password-input';
import { t } from '@/i18n';
import { isInvalidLinkToken, useResetPassword } from '../api';
import { LinkExpired } from './link-expired';
import { PasswordHint, passwordError } from './password-hint';
import {
  type RequestFailure,
  RequestFailureAlert,
  readRequestFailure,
} from './request-failure';

/**
 * The API body is `resetPasswordSchema` (token + password); the confirmation
 * only exists in the form, to catch a typo in a password nobody can see.
 */
const resetPasswordFormSchema = z
  .object({ password: passwordSchema, confirmation: z.string() })
  .refine(({ password, confirmation }) => password === confirmation, {
    path: ['confirmation'],
    message: 'Passwords do not match',
  });

type ResetPasswordForm = z.infer<typeof resetPasswordFormSchema>;

const headingClass =
  'm-0 font-heading text-display font-medium outline-none lg:text-[40px] lg:leading-[1.1]';

function Done() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
        <CheckIcon aria-hidden className="size-10" strokeWidth={2.4} />
      </span>
      <header className="flex flex-col gap-2.5">
        <h1 ref={heading} tabIndex={-1} className={headingClass}>
          {t.resetPassword.doneTitle}
        </h1>
        <p className="m-0 text-muted-foreground">{t.resetPassword.doneBody}</p>
      </header>
      <Link
        to="/login"
        className={buttonVariants({ size: 'lg', fullWidth: true })}
      >
        {t.resetPassword.signIn}
      </Link>
    </div>
  );
}

/**
 * Sets a new password with the token of the emailed link. The API ends every
 * session of the user, this one too, so the user signs in again afterwards.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const resetPassword = useResetPassword();
  const [outcome, setOutcome] = useState<'done' | 'expired' | null>(
    token ? null : 'expired',
  );
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const onSubmit = async ({ password }: ResetPasswordForm) => {
    if (!token) {
      return;
    }
    setFailure(null);
    try {
      await resetPassword.mutateAsync({ token, password });
      setOutcome('done');
    } catch (error) {
      if (isInvalidLinkToken(error)) {
        setOutcome('expired');
      } else {
        setFailure(readRequestFailure(error));
      }
    }
  };

  if (outcome === 'done') {
    return <Done />;
  }

  if (outcome === 'expired') {
    return (
      <LinkExpired>
        <Link
          to="/forgot-password"
          className={buttonVariants({ size: 'lg', fullWidth: true })}
        >
          {t.linkExpired.requestNew}
        </Link>
      </LinkExpired>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className={headingClass}>{t.resetPassword.title}</h1>

      {failure && (
        <RequestFailureAlert
          failure={failure}
          unknownBody={t.resetPassword.failedBody}
        />
      )}

      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-[18px]"
      >
        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.resetPassword.password}
              description={<PasswordHint password={field.value} />}
              error={fieldState.error && passwordError(field.value)}
            >
              {(controlProps) => (
                <PasswordInput
                  {...controlProps}
                  {...field}
                  autoComplete="new-password"
                />
              )}
            </FormField>
          )}
        />

        <Controller
          name="confirmation"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.resetPassword.confirmation}
              error={
                fieldState.error &&
                (field.value
                  ? t.resetPassword.mismatch
                  : t.resetPassword.confirmationRequired)
              }
            >
              {(controlProps) => (
                <PasswordInput
                  {...controlProps}
                  {...field}
                  autoComplete="new-password"
                />
              )}
            </FormField>
          )}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={formState.isSubmitting}
        >
          {t.resetPassword.submit}
        </Button>
        <p className="m-0 text-meta text-muted-foreground">
          {t.resetPassword.signsOut}
        </p>
      </form>
    </div>
  );
}
