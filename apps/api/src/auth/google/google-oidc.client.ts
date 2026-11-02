import { Inject, Injectable } from '@nestjs/common';
import * as client from 'openid-client';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

const GOOGLE_ISSUER = new URL('https://accounts.google.com');
/** No more than sign-in needs: these scopes avoid Google's app verification. */
const SCOPE = 'openid email profile';
const CALLBACK_PATH = '/api/auth/google/callback';

/** Values that tie Google's answer to the browser that started the sign-in. */
export interface GoogleFlowChecks {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface GoogleAuthorizationRequest {
  /** Where to send the browser. */
  url: string;
  checks: GoogleFlowChecks;
}

export interface GoogleIdentity {
  /** Stable id of the Google account. The only thing to match a person by. */
  sub: string;
  email: string;
  emailVerified: boolean;
  /** Google never guarantees this claim. */
  name?: string;
  /** Google Workspace or Cloud organization of the account, if any. */
  hostedDomain?: string;
}

const idTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.boolean(),
  name: z.string().optional(),
  hd: z.string().optional(),
});

/**
 * The only code that talks to Google. `openid-client` validates the response:
 * `state`, the PKCE exchange and the ID token's `iss`, `aud`, `exp` and
 * `nonce`. The token comes straight from Google's token endpoint over TLS,
 * which OpenID Connect accepts in place of checking its signature.
 *
 * `openid-client`'s Passport strategy is not used: it needs `express-session`,
 * and sessions here are our own code.
 */
@Injectable()
export class GoogleOidcClient {
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string;
  private configuration: Promise<client.Configuration> | undefined;

  constructor(
    @Inject(APP_CONFIG)
    config: Pick<
      AppConfig,
      'APP_ORIGIN' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'
    >,
  ) {
    this.clientId = config.GOOGLE_CLIENT_ID;
    this.clientSecret = config.GOOGLE_CLIENT_SECRET;
    // From the configured origin, never from `Host`: it must match the URI
    // registered at Google, also behind Railway's edge and the Vite proxy.
    this.redirectUri = `${config.APP_ORIGIN}${CALLBACK_PATH}`;
  }

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async createAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    const configuration = await this.discover();
    const checks: GoogleFlowChecks = {
      state: client.randomState(),
      nonce: client.randomNonce(),
      codeVerifier: client.randomPKCECodeVerifier(),
    };
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: SCOPE,
      state: checks.state,
      nonce: checks.nonce,
      code_challenge: await client.calculatePKCECodeChallenge(
        checks.codeVerifier,
      ),
      code_challenge_method: 'S256',
    });
    return { url: url.href, checks };
  }

  /**
   * Exchanges the code in `callbackQuery` (the raw query string of the
   * callback) and returns who signed in. Throws on any invalid response,
   * including the user cancelling at Google.
   */
  async exchangeCode(
    callbackQuery: string,
    checks: GoogleFlowChecks,
  ): Promise<GoogleIdentity> {
    const configuration = await this.discover();
    const tokens = await client.authorizationCodeGrant(
      configuration,
      new URL(`${this.redirectUri}?${callbackQuery}`),
      {
        expectedState: checks.state,
        expectedNonce: checks.nonce,
        pkceCodeVerifier: checks.codeVerifier,
        idTokenExpected: true,
      },
    );
    const claims = idTokenClaimsSchema.parse(tokens.claims());
    return {
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name,
      hostedDomain: claims.hd,
    };
  }

  /**
   * Fetches Google's endpoints on first use, not at startup, so the API boots
   * while Google is unreachable. A failure is not kept: the next sign-in
   * retries.
   */
  private discover(): Promise<client.Configuration> {
    const { clientId, clientSecret } = this;
    if (!clientId || !clientSecret) {
      throw new Error('Google sign-in is not configured');
    }
    this.configuration ??= client
      .discovery(GOOGLE_ISSUER, clientId, clientSecret)
      .catch((error: unknown) => {
        this.configuration = undefined;
        throw error;
      });
    return this.configuration;
  }
}
