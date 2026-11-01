import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

const APP_ORIGIN = 'https://app.example.com';

function setup(method: string, headers: Record<string, string> = {}) {
  const guard = new CsrfGuard({ APP_ORIGIN });
  const request = { method, get: (name: string) => headers[name] };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return () => guard.canActivate(context);
}

describe('CsrfGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'does not check %s requests',
    (method) => {
      const check = setup(method, {
        'sec-fetch-site': 'cross-site',
        origin: 'https://evil.example',
      });

      expect(check()).toBe(true);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'accepts %s from the app origin',
    (method) => {
      const check = setup(method, {
        'sec-fetch-site': 'same-origin',
        origin: APP_ORIGIN,
      });

      expect(check()).toBe(true);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects %s from another origin',
    (method) => {
      const check = setup(method, { origin: 'https://evil.example' });

      expect(check).toThrow(ForbiddenException);
    },
  );

  it('rejects unknown methods, not only the listed unsafe ones', () => {
    const check = setup('PROPFIND', { origin: 'https://evil.example' });

    expect(check).toThrow(ForbiddenException);
  });

  it('rejects Sec-Fetch-Site: cross-site even with a matching origin', () => {
    const check = setup('POST', {
      'sec-fetch-site': 'cross-site',
      origin: APP_ORIGIN,
    });

    expect(check).toThrow(ForbiddenException);
  });

  it.each(['same-origin', 'same-site', 'none', 'future-value'])(
    'still checks the origin when Sec-Fetch-Site is %s',
    (site) => {
      const check = setup('POST', {
        'sec-fetch-site': site,
        origin: 'https://evil.example',
      });

      expect(check).toThrow(ForbiddenException);
    },
  );

  it('does not trust a sibling subdomain', () => {
    const check = setup('POST', {
      'sec-fetch-site': 'same-site',
      origin: 'https://other.example.com',
    });

    expect(check).toThrow(ForbiddenException);
  });

  it.each([
    ['a domain that starts with the app host', `${APP_ORIGIN}.evil.example`],
    ['another scheme', 'http://app.example.com'],
    ['another port', `${APP_ORIGIN}:8443`],
    ['a trailing slash', `${APP_ORIGIN}/`],
    ['an empty value', ''],
  ])('rejects an origin with %s', (_case, origin) => {
    const check = setup('POST', { origin });

    expect(check).toThrow(ForbiddenException);
  });

  it('rejects Origin: null without falling back to Referer', () => {
    const check = setup('POST', {
      origin: 'null',
      referer: `${APP_ORIGIN}/patients`,
    });

    expect(check).toThrow(ForbiddenException);
  });

  it('does not fall back to Referer when Origin does not match', () => {
    const check = setup('POST', {
      origin: 'https://evil.example',
      referer: `${APP_ORIGIN}/patients`,
    });

    expect(check).toThrow(ForbiddenException);
  });

  it('accepts a Referer from the app when Origin is absent', () => {
    const check = setup('POST', { referer: `${APP_ORIGIN}/patients?page=2` });

    expect(check()).toBe(true);
  });

  it.each([
    ['another site', 'https://evil.example/page'],
    ['the app origin as a prefix', `${APP_ORIGIN}.evil.example/page`],
    ['the app origin as a path', `https://evil.example/${APP_ORIGIN}`],
    ['a value that is not a URL', 'not a url'],
  ])('rejects a Referer with %s when Origin is absent', (_case, referer) => {
    const check = setup('POST', { referer });

    expect(check).toThrow(ForbiddenException);
  });

  it('rejects a request with neither Origin nor Referer', () => {
    const check = setup('POST');

    expect(check).toThrow(ForbiddenException);
  });
});
