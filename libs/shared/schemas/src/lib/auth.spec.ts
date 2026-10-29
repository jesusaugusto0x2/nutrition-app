import {
  authUserSchema,
  emailSchema,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
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
