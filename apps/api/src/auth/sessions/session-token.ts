import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

// 32 bytes in unpadded base64url are always 43 characters.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** A new opaque session token: 32 random bytes, base64url-encoded. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Only this hash is stored; sessions are looked up by it. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cheap shape check so malformed cookies never reach the database. */
export function isWellFormedSessionToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
