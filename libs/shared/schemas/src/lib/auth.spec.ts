import {
  authUserSchema,
  emailSchema,
  forgotPasswordSchema,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  resetPasswordSchema,
  signInSchema,
} from './auth.js';

describe('normalizeEmail', () => {
  it('trims and lowercases the email', () => {
    expect(normalizeEmail('  Ana.Torres@Example.COM \n')).toBe(
      'ana.torres@example.com',
    );
  });

  it('maps every letter-case variant to the same email', () => {
    expect(normalizeEmail('OWNER@example.com')).toBe(
      normalizeEmail('owner@EXAMPLE.com'),
    );
  });
});

describe('emailSchema', () => {
  it('returns the normalized email', () => {
    expect(emailSchema.parse(' Owner@Example.com ')).toBe('owner@example.com');
  });

  it.each(['', 'not-an-email', 'owner@', `${'a'.repeat(250)}@x.com`])(
    'rejects %s',
    (value) => {
      expect(emailSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('authUserSchema', () => {
  it('strips the password hash from a user row', () => {
    const result = authUserSchema.parse({
      id: '00000000-0000-4000-8000-000000000002',
      email: 'owner@example.com',
      name: 'Owner',
      emailVerified: true,
      passwordHash: '$argon2id$v=19$...',
    });

    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('signInSchema', () => {
  it('normalizes the email and keeps the password as typed', () => {
    expect(
      signInSchema.parse({
        email: ' Owner@Example.com ',
        password: ' secret ',
      }),
    ).toEqual({ email: 'owner@example.com', password: ' secret ' });
  });

  it('accepts a password of the maximum length', () => {
    const password = 'a'.repeat(PASSWORD_MAX_LENGTH);

    expect(
      signInSchema.safeParse({ email: 'owner@example.com', password }).success,
    ).toBe(true);
  });

  it.each([
    { email: 'owner@example.com', password: '' },
    {
      email: 'owner@example.com',
      password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
    },
    { email: 'not-an-email', password: 'secret' },
    { email: 'owner@example.com' },
    { password: 'secret' },
  ])('rejects %o', (body) => {
    expect(signInSchema.safeParse(body).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a password of the minimum length without composition rules', () => {
    expect(passwordSchema.parse('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(
      'a'.repeat(PASSWORD_MIN_LENGTH),
    );
  });

  it('rejects a password one character shorter than the minimum', () => {
    expect(
      passwordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH - 1)).success,
    ).toBe(false);
  });

  it('counts each code point as one character', () => {
    // 15 emoji are 30 UTF-16 code units but 15 characters.
    expect(passwordSchema.safeParse('🍎'.repeat(15)).success).toBe(true);
    expect(passwordSchema.safeParse('🍎'.repeat(14)).success).toBe(false);
  });

  it('keeps spaces as typed', () => {
    expect(passwordSchema.parse('  correct horse battery  ')).toBe(
      '  correct horse battery  ',
    );
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(
      passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success,
    ).toBe(true);
    expect(
      passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH + 1)).success,
    ).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('normalizes the email', () => {
    expect(forgotPasswordSchema.parse({ email: ' Ana@Example.com ' })).toEqual({
      email: 'ana@example.com',
    });
  });
});

describe('resetPasswordSchema', () => {
  const password = 'correct horse battery staple';

  it('accepts a token and a valid new password', () => {
    expect(resetPasswordSchema.parse({ token: 'abc', password })).toEqual({
      token: 'abc',
      password,
    });
  });

  it.each([
    { token: '', password },
    { token: 'a'.repeat(257), password },
    { token: 'abc', password: 'too short' },
    { password },
    { token: 'abc' },
  ])('rejects %o', (body) => {
    expect(resetPasswordSchema.safeParse(body).success).toBe(false);
  });
});
