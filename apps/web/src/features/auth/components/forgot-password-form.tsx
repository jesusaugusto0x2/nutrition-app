import { Link } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useForgotPassword } from '../api';
import { CheckEmail } from './check-email';
import { EmailLinkForm } from './email-link-form';

/**
 * Asks for a password reset link. The answer is the same whether or not the
 * email has an account, as the API's.
 */
export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  /** Set once the API accepted the request: the check-your-email screen. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cameBack, setCameBack] = useState(false);

  if (sentTo !== null) {
    return (
      <CheckEmail
        email={sentTo}
        purpose="passwordReset"
        onChangeEmail={() => {
          setSentTo(null);
          setCameBack(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        to="/login"
        className="flex min-h-touch items-center gap-1 self-start font-bold"
      >
        <ChevronLeftIcon
          aria-hidden
          className="size-[22px]"
          strokeWidth={2.2}
        />
        {t.forgotPassword.backToSignIn}
      </Link>

      <header className="flex flex-col gap-2.5">
        <h1 className="m-0 font-heading text-display font-medium lg:text-[40px] lg:leading-[1.1]">
          {t.forgotPassword.title}
        </h1>
        <p className="m-0 text-muted-foreground">{t.forgotPassword.subtitle}</p>
      </header>

      <EmailLinkForm
        submitLabel={t.forgotPassword.submit}
        unknownBody={t.forgotPassword.failedBody}
        send={(email) => forgotPassword.mutateAsync({ email })}
        onSent={setSentTo}
        focusOnMount={cameBack}
      />

      <p className="m-0 text-meta text-muted-foreground">
        {t.forgotPassword.googleHint}
      </p>
    </div>
  );
}
