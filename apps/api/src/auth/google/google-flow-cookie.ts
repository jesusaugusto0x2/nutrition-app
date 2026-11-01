import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type { GoogleFlowChecks } from './google-oidc.client';

// `__Host-` as in `SessionCookie`: it stops a sibling subdomain from planting
// its own values, which is what would defeat `state`.
export const PRODUCTION_GOOGLE_FLOW_COOKIE = '__Host-google-flow';
export const DEVELOPMENT_GOOGLE_FLOW_COOKIE = 'google-flow';

/** How long the user has to finish signing in at Google. */
export const GOOGLE_FLOW_LIFETIME_MS = 10 * 60 * 1000;

const SEPARATOR = '.';
/** Each value is URL-safe base64, so it cannot contain the separator. */
const WELL_FORMED_VALUE = /^[A-Za-z0-9_-]+$/;

/**
 * Keeps `state`, `nonce` and the PKCE verifier in the browser between leaving
 * for Google and coming back. It proves the callback belongs to the browser
 * that started the sign-in, so no server state is needed.
 *
 * SameSite=Lax, not Strict: the callback is a navigation from Google, and
 * Strict would not send the cookie with it.
 */
@Injectable()
export class GoogleFlowCookie {
  readonly name: string;
  private readonly options: CookieOptions;

  constructor(@Inject(APP_CONFIG) config: Pick<AppConfig, 'NODE_ENV'>) {
    const production = config.NODE_ENV === 'production';
    this.name = production
      ? PRODUCTION_GOOGLE_FLOW_COOKIE
      : DEVELOPMENT_GOOGLE_FLOW_COOKIE;
    this.options = {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
    };
  }

  set(response: Response, checks: GoogleFlowChecks): void {
    const value = [checks.state, checks.nonce, checks.codeVerifier].join(
      SEPARATOR,
    );
    response.cookie(this.name, value, {
      ...this.options,
      maxAge: GOOGLE_FLOW_LIFETIME_MS,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.name, this.options);
  }

  /** The checks, or `null` when the cookie is missing, expired or malformed. */
  read(request: Request): GoogleFlowChecks | null {
    const cookies: unknown = request.cookies;
    if (typeof cookies !== 'object' || cookies === null) {
      return null;
    }
    const value = (cookies as Record<string, unknown>)[this.name];
    if (typeof value !== 'string') {
      return null;
    }
    const parts = value.split(SEPARATOR);
    if (
      parts.length !== 3 ||
      !parts.every((part) => WELL_FORMED_VALUE.test(part))
    ) {
      return null;
    }
    const [state, nonce, codeVerifier] = parts;
    return { state, nonce, codeVerifier };
  }
}
