import { safeRedirectPath, validateLoginSearch } from './redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/patients'],
    ['/patients/00000000-0000-4000-8000-000000000001'],
    ['/patients?tab=history#weight'],
    ['/'],
  ])('accepts the internal path %s', (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    ['a protocol-relative URL', '//evil.com'],
    ['an absolute URL', 'https://evil.com'],
    ['a backslash after the slash', '/\\evil.com'],
    ['a backslash pair', '\\\\evil.com'],
    ['a tab between the slashes', '/\t/evil.com'],
    ['a newline between the slashes', '/\n/evil.com'],
    ['a path that normalizes to two slashes', '/..//evil.com'],
    ['a script URL', 'javascript:alert(1)'],
    ['a relative path', 'patients'],
    ['an empty string', ''],
    ['a bare double slash', '//'],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirectPath(value)).toBeUndefined();
  });

  it.each([[undefined], [null], [123], [['/patients']]])(
    'rejects the non-string value %j',
    (value) => {
      expect(safeRedirectPath(value)).toBeUndefined();
    },
  );
});

describe('validateLoginSearch', () => {
  it('keeps an internal redirect', () => {
    expect(validateLoginSearch({ redirect: '/patients' })).toEqual({
      redirect: '/patients',
    });
  });

  it('overrides a redirect that leaves the app', () => {
    expect(validateLoginSearch({ redirect: '//evil.com' })).toStrictEqual({
      redirect: undefined,
      error: undefined,
    });
  });

  it('keeps the Google sign-in error', () => {
    expect(validateLoginSearch({ error: 'google' })).toStrictEqual({
      redirect: undefined,
      error: 'google',
    });
  });

  it.each([['other'], [['google']], [1]])(
    'drops an unknown error %j',
    (error) => {
      expect(validateLoginSearch({ error }).error).toBeUndefined();
    },
  );
});
