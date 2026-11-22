import { COMPROMISED_PASSWORDS } from './password-blocklist-data';

/**
 * Whether `password` appears in the bundled list of publicly known
 * compromised or commonly used passwords (NIST SP 800-63B-4 §3.1.1.2),
 * enforced at the API on sign-up and password reset. The list is bundled —
 * not an external API — so the check is deterministic, offline and has no
 * failure mode of its own. It lives in the API only, never in the shared
 * schema, so the list stays out of the web bundle (docs/authentication.md).
 *
 * Only the comparison copy is trimmed and lowercased; the password that gets
 * hashed and stored is never modified here.
 */
export function isCompromisedPassword(password: string): boolean {
  return COMPROMISED_PASSWORDS.has(password.trim().toLowerCase());
}
