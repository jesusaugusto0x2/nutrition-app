import { zodResolver } from '@hookform/resolvers/zod';
import {
  SIGN_UP_NAME_MAX_LENGTH,
  type SignUp,
  signUpSchema,
} from '@nutri/schemas';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { t } from '@/i18n';
import { useSignUp } from '../api';
import { CheckEmail } from './check-email';
import { PasswordHint, passwordError } from './password-hint';
import {
  type RequestFailure,
  RequestFailureAlert,
  readRequestFailure,
} from './request-failure';

/**
 * The schema decides whether a field is valid; these pick the Spanish text,
 * since the schema messages are English.
 */
function nameError(value: string, required: string): string {
  return value.trim() ? t.signUp.tooLong(SIGN_UP_NAME_MAX_LENGTH) : required;
}

export function SignUpForm() {
  const signUp = useSignUp();
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  /** Set once the API accepted the request: the check-your-email screen. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { control, handleSubmit, formState, setFocus } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', clinicName: '' },
  });

  // `values` went through the schema: trimmed names, normalized email.
  const onSubmit = async (values: SignUp) => {
    setFailure(null);
    try {
      await signUp.mutateAsync(values);
      setSentTo(values.email);
    } catch (error) {
      setFailure(readRequestFailure(error));
    }
  };

  if (sentTo !== null) {
    return (
      <CheckEmail
        email={sentTo}
        onChangeEmail={() => {
          setSentTo(null);
          // After the form is back on screen.
          setTimeout(() => setFocus('email'));
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 font-heading text-display font-medium lg:text-[40px] lg:leading-[1.1]">
          {t.signUp.title}
        </h1>
        <p className="m-0 text-muted-foreground">{t.signUp.subtitle}</p>
      </header>

      {failure && (
        <RequestFailureAlert
          failure={failure}
          unknownBody={t.signUp.failedBody}
        />
      )}

      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-[18px]"
      >
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.signUp.name}
              error={
                fieldState.error &&
                nameError(field.value, t.signUp.nameRequired)
              }
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  {...field}
                  size="lg"
                  autoComplete="name"
                  placeholder={t.signUp.namePlaceholder}
                />
              )}
            </FormField>
          )}
        />

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

        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.auth.password}
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
          name="clinicName"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.signUp.clinicName}
              description={t.signUp.clinicNameHelp}
              error={
                fieldState.error &&
                nameError(field.value, t.signUp.clinicNameRequired)
              }
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  {...field}
                  size="lg"
                  autoComplete="organization"
                  placeholder={t.signUp.clinicNamePlaceholder}
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
          {t.signUp.submit}
        </Button>
      </form>

      <footer className="mt-auto border-t pt-5 text-center lg:mt-0">
        {t.signUp.haveAccount}{' '}
        <Link to="/login" className="font-bold">
          {t.signUp.signIn}
        </Link>
      </footer>
    </div>
  );
}
