import type { NextFunction, Request, Response } from 'express';
import {
  STRICT_TRANSPORT_SECURITY,
  strictTransportSecurity,
} from './strict-transport-security';

describe('strictTransportSecurity', () => {
  function run(appOrigin: string) {
    const middleware = strictTransportSecurity(appOrigin);
    const setHeader = vi.fn();
    const next = vi.fn();
    middleware?.(
      {} as Request,
      { setHeader } as unknown as Response,
      next as NextFunction,
    );
    return { middleware, setHeader, next };
  }

  it('sends a one-year HSTS header for an HTTPS origin', () => {
    const { setHeader, next } = run('https://app.example.com');

    expect(setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000',
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('neither covers subdomains nor asks for preloading', () => {
    expect(STRICT_TRANSPORT_SECURITY).not.toMatch(/includeSubDomains|preload/i);
  });

  it('is disabled for an HTTP origin', () => {
    expect(run('http://localhost:4200').middleware).toBeUndefined();
  });
});
