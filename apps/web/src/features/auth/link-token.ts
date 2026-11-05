import { oneTimeTokenSchema } from '@nutri/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/** Search params of a page opened from an emailed link. */
export interface LinkSearch {
  /** Raw, still unvalidated; `''` when present but not text. */
  token?: string;
}

/**
 * Keeps whatever came as `token`, even malformed, so the page knows it must
 * still remove it from the address bar. The router parses search values as
 * JSON, so a value that is not text arrives as a number or an array.
 */
export function validateLinkSearch(
  search: Record<string, unknown>,
): LinkSearch {
  const { token } = search;
  if (token === undefined) {
    return { token: undefined };
  }
  return { token: typeof token === 'string' ? token : '' };
}

/**
 * Reads the token of an emailed link once and removes it from the address
 * bar with a `replace` navigation, so it is neither kept in the history nor
 * shared by copying the URL. Returns `null` for a missing or malformed token,
 * which the page shows as an expired link.
 *
 * The token lives only in this component's state: never in the query cache,
 * a loader or storage, and never logged.
 */
export function useLinkToken(tokenInUrl: string | undefined): string | null {
  const [token] = useState(() =>
    oneTimeTokenSchema.safeParse(tokenInUrl).success
      ? (tokenInUrl as string)
      : null,
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (tokenInUrl !== undefined) {
      void navigate({ to: '.', search: {}, replace: true });
    }
  }, [tokenInUrl, navigate]);

  return token;
}
