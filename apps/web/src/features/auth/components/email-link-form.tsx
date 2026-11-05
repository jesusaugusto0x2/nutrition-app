import { zodResolver } from '@hookform/resolvers/zod';
import { type ForgotPassword, forgotPasswordSchema } from '@nutri/schemas';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import {
  type RequestFailure,
  RequestFailureAlert,
  readRequestFailure,
} from './request-failure';

/**
 * Asks for an email to send a link to (password reset, a new verification
 * link). `forgotPasswordSchema` has the same shape as
 * `resendVerificationSchema`: just a normalized email.
 */
export function EmailLinkForm({
  submitLabel,
  unknownBody,
  send,
  onSent,
  focusOnMount = false,
}: {
  submitLabel: string;
  /** Shown when the request fails for a reason other than rate limiting. */
  unknownBody: string;
  /** Receives the normalized email. */
  send: (email: string) => Promise<void>;
  onSent: (email: string) => void;
  /** When coming back from the check-your-email screen. */
  focusOnMount?: boolean;
}) {
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const { control, handleSubmit, formState, setFocus } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (focusOnMount) {
      setFocus('email');
    }
  }, [focusOnMount, setFocus]);

  const onSubmit = async ({ email }: ForgotPassword) => {
    setFailure(null);
    try {
      await send(email);
      onSent(email);
    } catch (error) {
      setFailure(readRequestFailure(error));
    }
  };

  return (
    <>
      {failure && (
        <RequestFailureAlert failure={failure} unknownBody={unknownBody} />
      )}

      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-5"
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

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={formState.isSubmitting}
        >
          {submitLabel}
        </Button>
      </form>
    </>
  );
}
