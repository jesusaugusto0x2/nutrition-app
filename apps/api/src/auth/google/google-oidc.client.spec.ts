import { type GoogleFlowChecks, GoogleOidcClient } from './google-oidc.client';

const CLIENT_ID = 'client-id.apps.googleusercontent.com';
const ISSUER = 'https://accounts.google.com';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const APP_ORIGIN = 'https://app.example.com';
const REDIRECT_URI = `${APP_ORIGIN}/api/auth/google/callback`;

const discoveryDocument = {
  issuer: ISSUER,
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: TOKEN_ENDPOINT,
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
};

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * A well-formed ID token. Its signature is not valid, and does not need to be:
 * a token from the token endpoint is trusted through TLS.
 */
function idToken(claims: Record<string, unknown>): string {
  return [
    base64Url({ alg: 'RS256', typ: 'JWT' }),
    base64Url(claims),
    Buffer.from('signature').toString('base64url'),
  ].join('.');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * The real `openid-client` against a fake Google, so these tests prove the
 * validation is switched on rather than assume it.
 */
describe('GoogleOidcClient', () => {
  const checks: GoogleFlowChecks = {
    state: 'expected-state',
    nonce: 'expected-nonce',
    codeVerifier: 'v'.repeat(43),
  };
  const callbackQuery = `code=the-code&state=${checks.state}`;

  let tokenClaims: Record<string, unknown>;
  let tokenRequests: URLSearchParams[];
  let discoveryFails: boolean;
  let fakeFetch: ReturnType<typeof vi.fn>;

  function validClaims() {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: ISSUER,
      aud: CLIENT_ID,
      iat: now,
      exp: now + 3600,
      nonce: checks.nonce,
      sub: 'google-sub',
      email: 'Ana@gmail.com',
      email_verified: true,
      name: 'Ana Torres',
    };
  }

  function newClient(): GoogleOidcClient {
    return new GoogleOidcClient({
      APP_ORIGIN,
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_CLIENT_SECRET: 'client-secret',
    });
  }

  beforeEach(() => {
    tokenClaims = validClaims();
    tokenRequests = [];
    discoveryFails = false;
    fakeFetch = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${ISSUER}/.well-known/openid-configuration`) {
        return Promise.resolve(
          discoveryFails
            ? new Response('unavailable', { status: 503 })
            : json(discoveryDocument),
        );
      }
      if (url === TOKEN_ENDPOINT) {
        tokenRequests.push(new URLSearchParams(init?.body as URLSearchParams));
        return Promise.resolve(
          json({
            access_token: 'access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            id_token: idToken(tokenClaims),
          }),
        );
      }
      throw new Error(`Unexpected request to ${url}`);
    });
    vi.stubGlobal('fetch', fakeFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('configured', () => {
    it('is false without credentials', () => {
      expect(new GoogleOidcClient({ APP_ORIGIN }).configured).toBe(false);
    });

    it('is true with both credentials', () => {
      expect(newClient().configured).toBe(true);
    });
  });

  describe('createAuthorizationRequest', () => {
    it('sends the browser to Google with state, nonce and an S256 challenge', async () => {
      const { url, checks: created } =
        await newClient().createAuthorizationRequest();

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        discoveryDocument.authorization_endpoint,
      );
      expect(Object.fromEntries(parsed.searchParams)).toEqual({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: 'openid email profile',
        state: created.state,
        nonce: created.nonce,
        code_challenge: expect.any(String),
        code_challenge_method: 'S256',
      });
    });

    it('never puts the PKCE verifier in the URL', async () => {
      const { url, checks: created } =
        await newClient().createAuthorizationRequest();

      expect(url).not.toContain(created.codeVerifier);
    });

    it('uses new values for every sign-in', async () => {
      const client = newClient();

      const first = await client.createAuthorizationRequest();
      const second = await client.createAuthorizationRequest();

      expect(second.checks.state).not.toBe(first.checks.state);
      expect(second.checks.nonce).not.toBe(first.checks.nonce);
      expect(second.checks.codeVerifier).not.toBe(first.checks.codeVerifier);
    });

    it('fetches the discovery document once', async () => {
      const client = newClient();

      await client.createAuthorizationRequest();
      await client.createAuthorizationRequest();

      expect(fakeFetch).toHaveBeenCalledTimes(1);
    });

    it('retries discovery after a failure', async () => {
      const client = newClient();
      discoveryFails = true;
      await expect(client.createAuthorizationRequest()).rejects.toThrow();

      discoveryFails = false;

      await expect(client.createAuthorizationRequest()).resolves.toMatchObject({
        url: expect.any(String),
      });
    });

    it('fails when Google is not configured', async () => {
      const client = new GoogleOidcClient({ APP_ORIGIN });

      await expect(client.createAuthorizationRequest()).rejects.toThrow(
        'not configured',
      );
    });
  });

  describe('exchangeCode', () => {
    it('returns the identity from a valid ID token', async () => {
      await expect(
        newClient().exchangeCode(callbackQuery, checks),
      ).resolves.toEqual({
        sub: 'google-sub',
        email: 'Ana@gmail.com',
        emailVerified: true,
        name: 'Ana Torres',
        hostedDomain: undefined,
      });
    });

    it('sends the code with the PKCE verifier and the configured redirect URI', async () => {
      await newClient().exchangeCode(callbackQuery, checks);

      const [request] = tokenRequests;
      expect(request.get('code')).toBe('the-code');
      expect(request.get('code_verifier')).toBe(checks.codeVerifier);
      expect(request.get('redirect_uri')).toBe(REDIRECT_URI);
    });

    it('keeps the hosted domain of a Workspace account', async () => {
      tokenClaims = { ...tokenClaims, hd: 'clinic.example' };

      await expect(
        newClient().exchangeCode(callbackQuery, checks),
      ).resolves.toMatchObject({ hostedDomain: 'clinic.example' });
    });

    it('accepts an ID token without a name', async () => {
      const { name: _name, ...claims } = tokenClaims;
      tokenClaims = claims;

      await expect(
        newClient().exchangeCode(callbackQuery, checks),
      ).resolves.toMatchObject({ name: undefined });
    });

    it.each([
      ['a wrong nonce', { nonce: 'other-nonce' }],
      ['no nonce', { nonce: undefined }],
      ['a wrong audience', { aud: 'another-client' }],
      ['a wrong issuer', { iss: 'https://evil.example' }],
      ['an expired token', { exp: Math.floor(Date.now() / 1000) - 3600 }],
      ['no email', { email: undefined }],
      ['a text email_verified', { email_verified: 'true' }],
    ])('rejects an ID token with %s', async (_case, claims) => {
      tokenClaims = { ...tokenClaims, ...claims };

      await expect(
        newClient().exchangeCode(callbackQuery, checks),
      ).rejects.toThrow();
    });

    it('rejects a wrong state before calling the token endpoint', async () => {
      await expect(
        newClient().exchangeCode('code=the-code&state=forged', checks),
      ).rejects.toThrow();

      expect(tokenRequests).toEqual([]);
    });

    it('rejects a callback where the user cancelled at Google', async () => {
      await expect(
        newClient().exchangeCode(
          `error=access_denied&state=${checks.state}`,
          checks,
        ),
      ).rejects.toThrow();

      expect(tokenRequests).toEqual([]);
    });
  });
});
