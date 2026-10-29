import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

// `__Host-` makes the browser reject the cookie unless it is Secure, has
// Path=/ and no Domain. It needs https, so development over http uses a
// plain name.
export const PRODUCTION_SESSION_COOKIE = '__Host-session';
export const DEVELOPMENT_SESSION_COOKIE = 'session';

/**
 * Sets, clears and reads the session cookie. Reading relies on the
 * `cookie-parser` middleware registered in main.ts.
 *
 * SameSite=Lax, not Strict: with Strict, opening the app from a link in
 * WhatsApp or an email would look signed out. CSRF has its own protection.
 */
@Injectable()
export class SessionCookie {
  readonly name: string;
  private readonly options: CookieOptions;

  constructor(@Inject(APP_CONFIG) config: Pick<AppConfig, 'NODE_ENV'>) {
    const production = config.NODE_ENV === 'production';
    this.name = production
      ? PRODUCTION_SESSION_COOKIE
      : DEVELOPMENT_SESSION_COOKIE;
    // No `domain`: the cookie stays host-only.
    this.options = {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
    };
  }

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.name, token, { ...this.options, expires: expiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(this.name, this.options);
  }

  /** The raw token, or `null` when the request has no session cookie. */
  read(request: Request): string | null {
    const cookies: unknown = request.cookies;
    if (typeof cookies !== 'object' || cookies === null) {
      return null;
    }
    const value = (cookies as Record<string, unknown>)[this.name];
    return typeof value === 'string' && value !== '' ? value : null;
  }
}
