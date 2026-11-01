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

export interface LoginSearch {
  redirect?: string;
}

/**
 * Always returns the `redirect` key: the router merges this over the raw URL
 * params, so leaving it out would hand a rejected value to `useSearch()`.
 */
export function validateLoginSearch(
  search: Record<string, unknown>,
): LoginSearch {
  return { redirect: safeRedirectPath(search.redirect) };
}
