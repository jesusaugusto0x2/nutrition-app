import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordLength,
} from '@nutri/schemas';
import { CheckIcon, CircleIcon } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Spanish text for a password `passwordSchema` rejected; the schema messages
 * are English.
 */
export function passwordError(value: string): string {
  return passwordLength(value) > PASSWORD_MAX_LENGTH
    ? t.signUp.tooLong(PASSWORD_MAX_LENGTH)
    : t.signUp.passwordTooShort(PASSWORD_MIN_LENGTH);
}

/**
 * The requirement of `passwordSchema`, checked as the user types. Length is
 * the only rule (no letters-and-numbers rules, see `passwordSchema`).
 */
export function PasswordHint({ password }: { password: string }) {
  const met = passwordLength(password) >= PASSWORD_MIN_LENGTH;
  const Icon = met ? CheckIcon : CircleIcon;
  return (
    <>
      <span
        className={cn(
          'flex items-center gap-2',
          met && 'font-bold text-primary',
        )}
      >
        <Icon
          aria-hidden
          className="size-[18px] flex-none"
          strokeWidth={met ? 2.8 : 2}
        />
        {t.signUp.passwordMinLength(PASSWORD_MIN_LENGTH)}
      </span>
      <span className="block">{t.signUp.passwordTip}</span>
    </>
  );
}
