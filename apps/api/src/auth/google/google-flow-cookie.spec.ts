import type { Request, Response } from 'express';
import {
  DEVELOPMENT_GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_LIFETIME_MS,
  GoogleFlowCookie,
  PRODUCTION_GOOGLE_FLOW_COOKIE,
} from './google-flow-cookie';

const checks = {
  state: 'state_value',
  nonce: 'nonce-value',
  codeVerifier: 'verifierValue123',
};

function fakeResponse() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

function requestWith(cookies: unknown): Request {
  return { cookies } as Request;
}

describe('GoogleFlowCookie', () => {
  const development = new GoogleFlowCookie({ NODE_ENV: 'development' });
  const production = new GoogleFlowCookie({ NODE_ENV: 'production' });

  it('uses the __Host- prefix in production only', () => {
    expect(production.name).toBe(PRODUCTION_GOOGLE_FLOW_COOKIE);
    expect(development.name).toBe(DEVELOPMENT_GOOGLE_FLOW_COOKIE);
  });

  it('sets a short-lived HttpOnly, Lax, Secure cookie in production', () => {
    const response = fakeResponse();

    production.set(response, checks);

    expect(response.cookie).toHaveBeenCalledWith(
      PRODUCTION_GOOGLE_FLOW_COOKIE,
      'state_value.nonce-value.verifierValue123',
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: GOOGLE_FLOW_LIFETIME_MS,
      },
    );
  });

  it('clears with the attributes it was set with', () => {
    const response = fakeResponse();

    production.clear(response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      PRODUCTION_GOOGLE_FLOW_COOKIE,
      { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    );
  });

  it('reads back what it set', () => {
    const response = fakeResponse();
    development.set(response, checks);
    const [name, value] = response.cookie.mock.calls[0] as [string, string];

    expect(development.read(requestWith({ [name]: value }))).toEqual(checks);
  });

  it.each([
    ['no cookies', undefined],
    ['another cookie', { other: 'a.b.c' }],
    ['too few parts', { [DEVELOPMENT_GOOGLE_FLOW_COOKIE]: 'a.b' }],
    ['too many parts', { [DEVELOPMENT_GOOGLE_FLOW_COOKIE]: 'a.b.c.d' }],
    ['an empty part', { [DEVELOPMENT_GOOGLE_FLOW_COOKIE]: 'a..c' }],
    ['unexpected characters', { [DEVELOPMENT_GOOGLE_FLOW_COOKIE]: 'a.b.c d' }],
    ['a value that is not text', { [DEVELOPMENT_GOOGLE_FLOW_COOKIE]: {} }],
  ])('reads %s as no flow', (_case, cookies) => {
    expect(development.read(requestWith(cookies))).toBeNull();
  });
});
