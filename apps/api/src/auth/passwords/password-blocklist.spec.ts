import { describe, expect, it } from 'vitest';
import { isCompromisedPassword } from './password-blocklist';

describe('isCompromisedPassword', () => {
  it('rejects the most common compromised passwords', () => {
    for (const password of ['123456', 'password', '123456789', 'qwerty']) {
      expect(isCompromisedPassword(password)).toBe(true);
    }
  });

  it('rejects common Spanish passwords, with and without accents', () => {
    expect(isCompromisedPassword('contraseña')).toBe(true);
    expect(isCompromisedPassword('Contrasena12345')).toBe(true);
    expect(isCompromisedPassword('venezuela123')).toBe(true);
  });

  it('compares case-insensitively and ignores surrounding spaces', () => {
    expect(isCompromisedPassword('  PASSWORD ')).toBe(true);
    expect(isCompromisedPassword('\tQwerty ')).toBe(true);
  });

  it('accepts long passphrases and strong passwords', () => {
    expect(isCompromisedPassword('correct horse battery staple')).toBe(false);
    expect(isCompromisedPassword('Tr3bol-naranja-río-9471')).toBe(false);
  });

  it('accepts the empty string', () => {
    expect(isCompromisedPassword('')).toBe(false);
  });
});
