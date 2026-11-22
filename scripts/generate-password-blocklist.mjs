// Regenerates apps/api/src/auth/passwords/password-blocklist-data.ts.
//
// Source: SecLists "10k-most-common.txt"
// (https://github.com/danielmiessler/SecLists, MIT license), the standard
// bundled common-password list, fetched at run time. SPANISH_SUPPLEMENT adds
// passwords common among this app's user base; it deliberately includes
// 15+ character patterns because PASSWORD_MIN_LENGTH is 15 — the raw SecLists
// top-10k is almost entirely shorter than that.
//
// Usage: node scripts/generate-password-blocklist.mjs
// Commit the regenerated data file in the same change that adds entries.

import { writeFileSync } from 'node:fs';

const SOURCE_URL =
  'https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10k-most-common.txt';

const SPANISH_SUPPLEMENT = [
  // Spanish common passwords and patterns.
  'contraseña',
  'contrasena',
  'contraseña1',
  'contrasena1',
  'contraseña12',
  'contrasena12',
  'contraseña123',
  'contrasena123',
  'contraseña1234',
  'contrasena1234',
  'clave',
  'clave123',
  'clave1234',
  'miclave',
  'micontraseña',
  'micontrasena',
  'tequiero',
  'tequiero123',
  'teamo',
  'teamo123',
  'venezuela',
  'venezuela123',
  'caracas',
  'caracas123',
  'maracaibo',
  'familia',
  'familia123',
  'amor',
  'amor123',
  'feliz',
  'feliz123',
  'cumpleaños',
  'cumpleanos',
  'futbol',
  'futbol123',
  'barcelona',
  'barca',
  'realmadrid',
  'messi',
  'messi10',
  'cr7',
  'ronaldo',
  'jesus',
  'jesus123',
  'jesuscristo',
  'maria',
  'maria123',
  'guadalupe',
  'carlos',
  'carlos123',
  'alejandro',
  'alejandro123',
  'ricardo',
  'andres',
  'andres123',
  'miguel',
  'miguel123',
  'jose',
  'jose123',
  'antonio',
  'camila',
  'camila123',
  'valentina',
  'valentina123',
  'sofia',
  'sofia123',
  'santiago',
  'santiago123',
  'estudiante',
  'estudiante123',
  'profesor',
  'doctor',
  'doctor123',
  // 15+ characters: realistic weak passwords under this app's 15 minimum.
  'contraseña12345',
  'contrasena12345',
  'password1234567',
  'passwordpassword',
  'password12345678',
  '123456789012345',
  '1234567890123456',
  '0123456789012345',
  'qwertyuiopasdfg',
  'qwertyuiop12345',
  'asdfghjkl123456',
  'iloveyouiloveyou',
  'iloveyou1234567',
  'tequieromucho123',
  'venezuela123456',
  'letmein12345678',
  'abcdef123456789',
  'abc123456789def',
  '1q2w3e4r5t6y7u8',
  'qazwsxedcrfvtgb',
];

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Could not fetch ${SOURCE_URL}: HTTP ${response.status}`);
}
const source = (await response.text())
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const entries = new Set(
  [...source, ...SPANISH_SUPPLEMENT].map((password) => password.toLowerCase()),
);

const lines = [...entries].map(
  (password) => `  '${password.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`,
);

const output = `/**
 * GENERATED FILE — do not edit by hand. Regenerate with
 * \`node scripts/generate-password-blocklist.mjs\` (fetches the source list
 * and rewrites this file; commit both in the same change).
 *
 * Bundled list of publicly known compromised or commonly used passwords,
 * enforced at the API on sign-up and password reset
 * (docs/authentication.md, «Passwords»). Entries are lowercase; the checker
 * compares a trimmed, lowercased candidate, so the stored password is never
 * modified. Source: SecLists "10k-most-common.txt" (MIT license) plus a
 * Spanish supplement with 15+ character patterns, because
 * PASSWORD_MIN_LENGTH is 15. Generated on 2026-11-21.
 */
export const COMPROMISED_PASSWORDS: ReadonlySet<string> = new Set([
${lines.join('\n')}
]);
`;

writeFileSync('apps/api/src/auth/passwords/password-blocklist-data.ts', output);
console.log(`Wrote ${entries.size} entries.`);
