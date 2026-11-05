import { zodResolver } from '@hookform/resolvers/zod';
import {
  type Onboarding,
  onboardingSchema,
  SIGN_UP_NAME_MAX_LENGTH,
} from '@nutri/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/ui/notice';
import { t } from '@/i18n';
import { ApiClientError } from '@/lib/api-client';
import { meQueryOptions, useOnboarding, useSignOut } from '../api';
import { homePath } from '../home-path';

/**
 * Asks a new Google user for the name of their clinic. A 409 means the
 * account no longer needs onboarding (another tab finished it, or an
 * invitation was accepted meanwhile): the user goes home as on success.
 */
export function OnboardingForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const onboarding = useOnboarding();
  const signOut = useSignOut();
  const [failed, setFailed] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { clinicName: '' },
  });

  const goHome = async () => {
    const me = await queryClient.fetchQuery(meQueryOptions());
    if (!me) {
      throw new Error('Onboarding without a session');
    }
    await router.navigate({ to: homePath(me) });
  };

  // `values` went through the schema: the name is trimmed.
  const onSubmit = async (values: Onboarding) => {
    setFailed(false);
    try {
      try {
        await onboarding.mutateAsync(values);
      } catch (error) {
        if (!(error instanceof ApiClientError && error.status === 409)) {
          throw error;
        }
      }
      await goHome();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 font-heading text-display font-medium lg:text-[40px] lg:leading-[1.1]">
          {t.onboarding.title}
        </h1>
        <p className="m-0 text-muted-foreground">{t.onboarding.subtitle}</p>
      </header>

      {failed && (
        <FormAlert title={t.common.errorTitle}>
          {t.onboarding.failedBody}
        </FormAlert>
      )}

      <form
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-[18px]"
      >
        <Controller
          name="clinicName"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label={t.signUp.clinicName}
              description={t.signUp.clinicNameHelp}
              error={
                fieldState.error &&
                (field.value.trim()
                  ? t.signUp.tooLong(SIGN_UP_NAME_MAX_LENGTH)
                  : t.signUp.clinicNameRequired)
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
          {t.onboarding.submit}
        </Button>
      </form>

      <footer className="mt-auto flex flex-col gap-2 border-t pt-5 text-center lg:mt-0">
        <span>
          {t.onboarding.otherAccount}{' '}
          <Button
            variant="text"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            {t.onboarding.signOut}
          </Button>
        </span>
        {signOut.isError && (
          <p role="alert" className="m-0 text-meta font-bold text-error">
            {t.onboarding.signOutFailed}
          </p>
        )}
      </footer>
    </div>
  );
}
