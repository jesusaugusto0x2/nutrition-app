/** Never reached: it only gives the parser an origin to compare against. */
const INTERNAL_ORIGIN = 'https://internal.invalid';

/**
 * Returns `value` as a path inside the app, or `undefined` when it could leave
 * it, so a crafted `/login?redirect=` link cannot send a user elsewhere after
 * they sign in (open redirect).
 *
 * Parses with the same algorithm as the browser instead of matching
 * characters by hand: browsers read `/\evil.com` as `//evil.com` and strip
 * tabs and newlines, so `/\t/evil.com` is another site too.
 */
export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return undefined;
  }

  // The second check catches `/..//evil.com`, which only collapses into a
  // protocol-relative path after normalization.
  if (url.origin !== INTERNAL_ORIGIN || url.pathname.startsWith('//')) {
    return undefined;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Why the API sent the browser back to the login page. Only `google` exists:
 * every Google sign-in failure lands on `/login?error=google`, with no details.
 */
export type LoginError = 'google';

export interface LoginSearch {
  redirect?: string;
  error?: LoginError;
}

/**
 * Always returns every key: the router merges this over the raw URL params,
 * so leaving one out would hand a rejected value to `useSearch()`.
 */
export function validateLoginSearch(
  search: Record<string, unknown>,
): LoginSearch {
  return {
    redirect: safeRedirectPath(search.redirect),
    error: search.error === 'google' ? 'google' : undefined,
  };
}
