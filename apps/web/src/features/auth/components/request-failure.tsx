import { FormAlert } from '@/components/ui/notice';
import { t } from '@/i18n';
import { isCompromisedPassword } from '../api';
import { readThrottle } from '../throttle';

/** Why a sign-up or "email me a link" request failed. */
export type RequestFailure =
  | { kind: 'throttled'; minutes: number | null }
  | { kind: 'compromised' }
  | { kind: 'unknown' };

export function readRequestFailure(error: unknown): RequestFailure {
  if (isCompromisedPassword(error)) {
    return { kind: 'compromised' };
  }
  const throttle = readThrottle(error);
  return throttle
    ? { kind: 'throttled', minutes: throttle.minutes }
    : { kind: 'unknown' };
}

export function RequestFailureAlert({
  failure,
  unknownBody,
}: {
  failure: RequestFailure;
  /** What the request was for, e.g. «No pudimos crear tu cuenta». */
  unknownBody: string;
}) {
  if (failure.kind === 'compromised') {
    return (
      <FormAlert title={t.common.errorTitle}>
        {t.auth.compromisedPasswordBody}
      </FormAlert>
    );
  }
  if (failure.kind === 'unknown') {
    return <FormAlert title={t.common.errorTitle}>{unknownBody}</FormAlert>;
  }
  return (
    <FormAlert title={t.auth.tooManyAttemptsTitle}>
      {failure.minutes === null
        ? t.signUp.tooManyAttemptsLater
        : t.signUp.tooManyAttemptsBody(failure.minutes)}
    </FormAlert>
  );
}
