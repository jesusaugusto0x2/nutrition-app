import { type INestApplication, type LoggerService } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { eq } from 'drizzle-orm';
import { AppModule } from '../../app.module';
import { APP_CONFIG } from '../../config/app-config';
import type { DatabaseConnection } from '../../database/client';
import { DATABASE_CONNECTION } from '../../database/database.tokens';
import { authAccounts, sessions, users } from '../../database/schema';
import {
  insertAuthAccount,
  insertSession,
  insertUser,
} from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { MAIL_TRANSPORT } from '../../mail/mail-transport';
import { FakeMailTransport } from '../../mail/testing/fake-mail-transport';
import { GOOGLE_RATE_LIMITS, IP_THROTTLER } from '../rate-limit/rate-limit';
import { PRODUCTION_SESSION_COOKIE } from '../sessions/session-cookie';
import { hashOpaqueToken } from '../tokens/opaque-token';
import { PRODUCTION_GOOGLE_FLOW_COOKIE } from './google-flow-cookie';
import { type GoogleIdentity, GoogleOidcClient } from './google-oidc.client';

const GOOGLE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x';
const checks = { state: 'the-state', nonce: 'the-nonce', codeVerifier: 'code' };
const FLOW_COOKIE = `${PRODUCTION_GOOGLE_FLOW_COOKIE}=the-state.the-nonce.code`;
const CALLBACK = 'google/callback?code=secret-code&state=the-state';

class RecordingLogger implements LoggerService {
  readonly lines: string[] = [];
  log = (...args: unknown[]) => this.record(args);
  error = (...args: unknown[]) => this.record(args);
  warn = (...args: unknown[]) => this.record(args);
  debug = (...args: unknown[]) => this.record(args);
  verbose = (...args: unknown[]) => this.record(args);
  private record(args: unknown[]): void {
    this.lines.push(args.map((arg) => String(arg)).join(' '));
  }
}

/**
 * The whole application with the real guards, cookies and database; only the
 * calls to Google are replaced.
 */
describe('GoogleAuthController', () => {
  const oidc = {
    configured: true,
    createAuthorizationRequest: vi.fn(),
    exchangeCode: vi.fn(),
  };
  let connection: DatabaseConnection;
  let app: INestApplication;
  let baseUrl: string;
  let logger: RecordingLogger;

  beforeAll(async () => {
    connection = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue({
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://app.example.com',
        MAIL_FROM: 'Mi consulta <no-reply@example.com>',
        CLIENT_IP_SOURCE: 'x-real-ip',
      })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(connection)
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(new FakeMailTransport())
      .overrideProvider(GoogleOidcClient)
      .useValue(oidc)
      .compile();

    logger = new RecordingLogger();
    app = moduleRef.createNestApplication({ logger });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    oidc.configured = true;
    oidc.createAuthorizationRequest.mockResolvedValue({
      url: GOOGLE_URL,
      checks,
    });
    logger.lines.length = 0;
  });

  // A new client IP per request unless a test picks one, so tests do not
  // share a per-IP rate-limit counter.
  let lastIp = 0;
  function nextIp(): string {
    lastIp += 1;
    return `10.${(lastIp >> 16) & 255}.${(lastIp >> 8) & 255}.${lastIp & 255}`;
  }

  function get(path: string, cookie?: string, ip: string = nextIp()) {
    return fetch(`${baseUrl}/api/auth/${path}`, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Test agent',
        'x-real-ip': ip,
        ...(cookie && { cookie }),
      },
    });
  }

  function signsInAs(identity: Partial<GoogleIdentity>) {
    oidc.exchangeCode.mockResolvedValue({
      sub: crypto.randomUUID(),
      email: 'nobody@gmail.com',
      emailVerified: true,
      name: 'Ana Torres',
      ...identity,
    });
  }

  function setCookie(response: Response, name: string): string | undefined {
    return response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith(`${name}=`));
  }

  function expectNoSession(response: Response) {
    expect(setCookie(response, PRODUCTION_SESSION_COOKIE)).toBeUndefined();
  }

  function expectFailure(response: Response) {
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?error=google');
    expectNoSession(response);
  }

  async function userByEmail(email: string) {
    const [user] = await connection.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  describe('GET /api/auth/google', () => {
    it('redirects to Google and stores the checks in a short-lived cookie', async () => {
      const response = await get('google');

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(GOOGLE_URL);
      expect(setCookie(response, PRODUCTION_GOOGLE_FLOW_COOKIE)).toMatch(
        /^__Host-google-flow=the-state\.the-nonce\.code; Max-Age=600; Path=\/; Expires=[^;]+ GMT; HttpOnly; Secure; SameSite=Lax$/,
      );
    });

    it('answers 404 when Google is not configured', async () => {
      oidc.configured = false;

      const response = await get('google');

      expect(response.status).toBe(404);
      expect(oidc.createAuthorizationRequest).not.toHaveBeenCalled();
    });

    it('redirects to the login page when Google cannot be reached', async () => {
      oidc.createAuthorizationRequest.mockRejectedValue(new TypeError('down'));

      const response = await get('google');

      expectFailure(response);
      expect(
        setCookie(response, PRODUCTION_GOOGLE_FLOW_COOKIE),
      ).toBeUndefined();
    });

    it('is rate limited per IP', async () => {
      const ip = nextIp();
      const { limit } = GOOGLE_RATE_LIMITS[IP_THROTTLER];
      for (let attempt = 0; attempt < limit; attempt++) {
        expect((await get('google', undefined, ip)).status).toBe(302);
      }

      expect((await get('google', undefined, ip)).status).toBe(429);
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('answers 404 when Google is not configured', async () => {
      oidc.configured = false;

      const response = await get(CALLBACK, FLOW_COOKIE);

      expect(response.status).toBe(404);
    });

    it('creates a verified user without a password and goes to onboarding', async () => {
      signsInAs({ sub: 'new-sub', email: 'New@Gmail.com', name: 'Ana' });

      const response = await get(CALLBACK, FLOW_COOKIE);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/onboarding');
      expect(setCookie(response, PRODUCTION_SESSION_COOKIE)).toMatch(
        /HttpOnly; Secure; SameSite=Lax$/,
      );
      const user = await userByEmail('new@gmail.com');
      expect(user).toMatchObject({ name: 'Ana', passwordHash: null });
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('signs in a linked user by sub, whatever email Google sends now', async () => {
      const user = await insertUser(connection.db);
      await insertAuthAccount(connection.db, user.id, 'linked-sub');
      const other = await insertUser(connection.db, {
        email: 'moved-to@gmail.com',
      });
      signsInAs({ sub: 'linked-sub', email: other.email });

      const response = await get(CALLBACK, FLOW_COOKIE);

      expect(response.headers.get('location')).toBe('/');
      const [session] = await connection.db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, user.id));
      expect(session.userAgent).toBe('Test agent');
      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.userId, other.id)),
      ).resolves.toEqual([]);
    });

    it('links a verified user and keeps the password', async () => {
      const user = await insertUser(connection.db, {
        email: 'verified@gmail.com',
        passwordHash: 'stored-hash',
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const session = await insertSession(connection.db, user.id);
      signsInAs({ sub: 'verified-sub', email: user.email });

      const response = await get(CALLBACK, FLOW_COOKIE);

      expect(response.headers.get('location')).toBe('/');
      await expect(userByEmail(user.email)).resolves.toMatchObject({
        passwordHash: 'stored-hash',
      });
      await expect(
        connection.db
          .select({ userId: authAccounts.userId })
          .from(authAccounts)
          .where(eq(authAccounts.providerAccountId, 'verified-sub')),
      ).resolves.toEqual([{ userId: user.id }]);
      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.id, session.id)),
      ).resolves.toHaveLength(1);
    });

    it('takes a pre-registered, unverified email away from whoever registered it', async () => {
      const user = await insertUser(connection.db, {
        email: 'victim@gmail.com',
        passwordHash: 'attacker-hash',
      });
      const attackerSession = await insertSession(connection.db, user.id);
      signsInAs({ sub: 'victim-sub', email: user.email });

      const response = await get(CALLBACK, FLOW_COOKIE);

      expect(response.headers.get('location')).toBe('/');
      const stored = await userByEmail(user.email);
      expect(stored.passwordHash).toBeNull();
      expect(stored.emailVerifiedAt).toBeInstanceOf(Date);
      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.id, attackerSession.id)),
      ).resolves.toEqual([]);
      await expect(
        connection.db
          .select({ id: authAccounts.id })
          .from(authAccounts)
          .where(eq(authAccounts.userId, user.id)),
      ).resolves.toHaveLength(1);
    });

    it('changes nothing for an account on an email Google does not vouch for', async () => {
      const user = await insertUser(connection.db, {
        email: 'someone@outlook.com',
        passwordHash: 'stored-hash',
      });
      const session = await insertSession(connection.db, user.id);
      signsInAs({ sub: 'third-party-sub', email: user.email });

      const response = await get(CALLBACK, FLOW_COOKIE);

      expectFailure(response);
      await expect(userByEmail(user.email)).resolves.toMatchObject({
        passwordHash: 'stored-hash',
        emailVerifiedAt: null,
      });
      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.id, session.id)),
      ).resolves.toHaveLength(1);
      await expect(
        connection.db
          .select()
          .from(authAccounts)
          .where(eq(authAccounts.userId, user.id)),
      ).resolves.toEqual([]);
    });

    it('rejects a wrong state', async () => {
      const response = await get(
        'google/callback?code=c&state=forged',
        FLOW_COOKIE,
      );

      expectFailure(response);
      expect(oidc.exchangeCode).not.toHaveBeenCalled();
    });

    it('rejects a callback without the flow cookie', async () => {
      const response = await get(CALLBACK);

      expectFailure(response);
      expect(oidc.exchangeCode).not.toHaveBeenCalled();
    });

    it('rejects an email Google has not verified', async () => {
      signsInAs({ email: 'unverified@gmail.com', emailVerified: false });

      const response = await get(CALLBACK, FLOW_COOKIE);

      expectFailure(response);
      await expect(
        userByEmail('unverified@gmail.com'),
      ).resolves.toBeUndefined();
    });

    it('sends no details to the URL or the log when Google fails', async () => {
      oidc.exchangeCode.mockRejectedValue(
        new TypeError('secret-code was rejected for patient@gmail.com'),
      );

      const response = await get(CALLBACK, FLOW_COOKIE);

      expectFailure(response);
      expect(logger.lines.join('\n')).toContain(
        'Google sign-in failed (TypeError)',
      );
      expect(logger.lines.join('\n')).not.toContain('secret-code');
      expect(logger.lines.join('\n')).not.toContain('patient@gmail.com');
    });

    it('logs why a sign-in was refused', async () => {
      await get('google/callback?code=c&state=forged', FLOW_COOKIE);

      expect(logger.lines.join('\n')).toContain(
        'Google sign-in failed (state-mismatch)',
      );
    });

    it.each([
      ['a success', () => signsInAs({ email: 'once@gmail.com' })],
      [
        'a failure',
        () => oidc.exchangeCode.mockRejectedValue(new TypeError('no')),
      ],
    ])('clears the flow cookie after %s', async (_case, arrange) => {
      arrange();

      const response = await get(CALLBACK, FLOW_COOKIE);

      expect(setCookie(response, PRODUCTION_GOOGLE_FLOW_COOKIE)).toMatch(
        /^__Host-google-flow=; Path=\/; Expires=Thu, 01 Jan 1970/,
      );
    });

    it('revokes the session the browser came in with', async () => {
      const user = await insertUser(connection.db);
      const previous = await insertSession(connection.db, user.id, {
        tokenHash: hashOpaqueToken('a'.repeat(43)),
      });
      signsInAs({ email: 'fixation@gmail.com' });

      await get(
        CALLBACK,
        `${FLOW_COOKIE}; ${PRODUCTION_SESSION_COOKIE}=${'a'.repeat(43)}`,
      );

      await expect(
        connection.db
          .select()
          .from(sessions)
          .where(eq(sessions.id, previous.id)),
      ).resolves.toEqual([]);
    });

    it('is rate limited per IP', async () => {
      const ip = nextIp();
      const { limit } = GOOGLE_RATE_LIMITS[IP_THROTTLER];
      for (let attempt = 0; attempt < limit; attempt++) {
        expect((await get(CALLBACK, undefined, ip)).status).toBe(302);
      }

      expect((await get(CALLBACK, undefined, ip)).status).toBe(429);
    });
  });
});
