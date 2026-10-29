import {
  type DynamicModule,
  type INestApplication,
  type LoggerService,
  Module,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { apiErrorSchema } from '@nutri/schemas';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { eq } from 'drizzle-orm';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { APP_CONFIG } from '../config/app-config';
import type { Database, DatabaseConnection } from '../database/client';
import { DATABASE } from '../database/database.tokens';
import { authTokens, users } from '../database/schema';
import { insertAuthToken, insertUser } from '../database/testing/fixtures';
import { createTestDatabase } from '../database/testing/test-database';
import { MAIL_TRANSPORT } from '../mail/mail-transport';
import { FakeMailTransport } from '../mail/testing/fake-mail-transport';
import { AuthModule } from './auth.module';
import { PASSWORD_HASH_OPTIONS } from './passwords/password-hash-options';
import { PasswordHasher } from './passwords/password-hasher';
import { PRODUCTION_SESSION_COOKIE } from './sessions/session-cookie';
import { SessionsService } from './sessions/sessions.service';
import { hashOpaqueToken } from './tokens/opaque-token';

const PASSWORD = 'correct horse battery staple';

/** Keeps every log line so tests can assert what was (not) logged. */
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

/** What DatabaseModule and ConfigModule provide globally in the app. */
@Module({})
class TestInfrastructureModule {
  static forDatabase(db: Database): DynamicModule {
    return {
      module: TestInfrastructureModule,
      global: true,
      providers: [
        { provide: DATABASE, useValue: db },
        {
          provide: APP_CONFIG,
          useValue: {
            NODE_ENV: 'production',
            APP_ORIGIN: 'https://app.example.com',
            MAIL_FROM: 'Mi consulta <no-reply@example.com>',
          },
        },
      ],
      exports: [DATABASE, APP_CONFIG],
    };
  }
}

/** The raw token from a `Set-Cookie` header of the session cookie. */
function sessionTokenFrom(response: Response): string {
  const header = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${PRODUCTION_SESSION_COOKIE}=`));
  if (!header) {
    throw new Error('No session cookie was set');
  }
  return header.slice(PRODUCTION_SESSION_COOKIE.length + 1).split(';')[0];
}

describe('AuthController', () => {
  let connection: DatabaseConnection;
  let app: INestApplication;
  let baseUrl: string;
  let logger: RecordingLogger;
  let sessions: SessionsService;
  let passwordHash: string;
  let mail: FakeMailTransport;

  beforeAll(async () => {
    connection = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [
        TestInfrastructureModule.forDatabase(connection.db),
        AuthModule,
      ],
      // The same global pipeline as AppModule.
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    })
      .overrideProvider(MAIL_TRANSPORT)
      .useValue((mail = new FakeMailTransport()))
      .compile();

    logger = new RecordingLogger();
    app = moduleRef.createNestApplication({ logger });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    sessions = moduleRef.get(SessionsService);
    passwordHash = await moduleRef.get(PasswordHasher).hash(PASSWORD);
  });

  afterAll(async () => {
    await app.close();
    await connection.close();
  });

  function post(path: string, body?: unknown, cookie?: string) {
    return fetch(`${baseUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Test agent',
        ...(cookie && { cookie: `${PRODUCTION_SESSION_COOKIE}=${cookie}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function signIn(email: string, password: string, cookie?: string) {
    return post('sign-in', { email, password }, cookie);
  }

  /** The error body without its timestamp, which differs per response. */
  async function errorBody(response: Response) {
    return apiErrorSchema
      .omit({ timestamp: true })
      .parse(await response.json());
  }

  describe('POST /api/auth/sign-in', () => {
    it('sets the session cookie and returns the user for correct credentials', async () => {
      const user = await insertUser(connection.db, {
        email: 'ana@example.com',
        name: 'Ana',
        passwordHash,
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const response = await signIn(' Ana@Example.com ', PASSWORD);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        id: user.id,
        email: 'ana@example.com',
        name: 'Ana',
        emailVerified: true,
      });
      const [cookie] = response.headers.getSetCookie();
      expect(cookie).toMatch(
        new RegExp(
          `^${PRODUCTION_SESSION_COOKIE}=[A-Za-z0-9_-]{43}; Path=/; Expires=[^;]+ GMT; HttpOnly; Secure; SameSite=Lax$`,
        ),
      );
      const session = await sessions.validate(sessionTokenFrom(response));
      expect(session?.user.id).toBe(user.id);
    });

    it('returns identical 401 bodies for a wrong password, an unknown email and a Google-only user', async () => {
      await insertUser(connection.db, {
        email: 'wrong@example.com',
        passwordHash,
      });
      await insertUser(connection.db, { email: 'google@example.com' });

      const responses = await Promise.all([
        signIn('wrong@example.com', 'not the password'),
        signIn('nobody@example.com', PASSWORD),
        signIn('google@example.com', PASSWORD),
      ]);

      expect(responses.map((response) => response.status)).toEqual([
        401, 401, 401,
      ]);
      const [wrongPassword, unknownEmail, googleOnly] = await Promise.all(
        responses.map(errorBody),
      );
      expect(wrongPassword).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        path: '/api/auth/sign-in',
      });
      expect(unknownEmail).toEqual(wrongPassword);
      expect(googleOnly).toEqual(wrongPassword);
      for (const response of responses) {
        expect(response.headers.getSetCookie()).toEqual([]);
      }
    });

    it('rejects a malformed body with a validation error before hashing', async () => {
      const tooLong = 'a'.repeat(257);

      const responses = await Promise.all([
        signIn('ana@example.com', tooLong),
        post('sign-in', { email: 'ana@example.com' }),
        post('sign-in', { email: 'not-an-email', password: PASSWORD }),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(400);
        const body = await response.text();
        expect(JSON.parse(body)).toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(body).not.toContain(tooLong);
      }
    });

    it('replaces the session of the incoming cookie with a new one', async () => {
      await insertUser(connection.db, {
        email: 'fixation@example.com',
        passwordHash,
      });
      const first = sessionTokenFrom(
        await signIn('fixation@example.com', PASSWORD),
      );

      const response = await signIn('fixation@example.com', PASSWORD, first);

      const second = sessionTokenFrom(response);
      expect(second).not.toBe(first);
      await expect(sessions.validate(first)).resolves.toBeNull();
      await expect(sessions.validate(second)).resolves.not.toBeNull();
    });

    it('rehashes a password stored with outdated parameters', async () => {
      const outdated = await argon2.hash(PASSWORD, {
        ...PASSWORD_HASH_OPTIONS,
        timeCost: 1,
      });
      const user = await insertUser(connection.db, {
        email: 'rehash@example.com',
        passwordHash: outdated,
      });

      const response = await signIn('rehash@example.com', PASSWORD);

      expect(response.status).toBe(200);
      const [row] = await connection.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.id));
      expect(row.passwordHash).not.toBe(outdated);
      expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
      await expect(
        argon2.verify(row.passwordHash ?? '', PASSWORD),
      ).resolves.toBe(true);
    });
  });

  describe('POST /api/auth/sign-out', () => {
    it('revokes the session, clears the cookie and rejects the old cookie afterwards', async () => {
      await insertUser(connection.db, {
        email: 'signout@example.com',
        passwordHash,
      });
      const token = sessionTokenFrom(
        await signIn('signout@example.com', PASSWORD),
      );

      const response = await post('sign-out', undefined, token);

      expect(response.status).toBe(204);
      expect(response.headers.getSetCookie()).toEqual([
        `${PRODUCTION_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`,
      ]);
      await expect(sessions.validate(token)).resolves.toBeNull();
    });

    it('answers 204 without a session cookie', async () => {
      const response = await post('sign-out');

      expect(response.status).toBe(204);
    });
  });

  describe('password reset', () => {
    const NEW_PASSWORD = 'a brand new passphrase';

    function emailsTo(to: string) {
      return mail.sent.filter((message) => message.to === to);
    }

    /** The token of the reset link emailed to `to`, once it arrives. */
    async function resetTokenSentTo(to: string): Promise<string> {
      return vi.waitFor(() => {
        const link = emailsTo(to)
          .map((message) =>
            message.text.match(
              /https:\/\/app\.example\.com\/reset-password\?token=([A-Za-z0-9_-]{43})/,
            ),
          )
          .filter((match) => match !== null)
          .pop();
        if (!link) {
          throw new Error(`No reset link was sent to ${to}`);
        }
        return link[1];
      });
    }

    function resetPassword(token: string, password = NEW_PASSWORD) {
      return post('reset-password', { token, password });
    }

    it('answers identically for an existing and an unknown email and emails only the existing one', async () => {
      await insertUser(connection.db, {
        email: 'forgot@example.com',
        passwordHash,
      });

      const [existing, unknown] = await Promise.all([
        post('forgot-password', { email: ' Forgot@Example.com ' }),
        post('forgot-password', { email: 'nobody-forgot@example.com' }),
      ]);

      expect(existing.status).toBe(202);
      expect(unknown.status).toBe(202);
      await expect(existing.text()).resolves.toBe('');
      await expect(unknown.text()).resolves.toBe('');
      expect(existing.headers.get('content-type')).toBe(
        unknown.headers.get('content-type'),
      );
      const token = await resetTokenSentTo('forgot@example.com');
      expect(emailsTo('nobody-forgot@example.com')).toEqual([]);
      const [row] = await connection.db
        .select({ tokenHash: authTokens.tokenHash })
        .from(authTokens)
        .where(eq(authTokens.tokenHash, hashOpaqueToken(token)));
      expect(row).toBeDefined();
      await expect(
        connection.db
          .select()
          .from(authTokens)
          .where(eq(authTokens.tokenHash, token)),
      ).resolves.toEqual([]);
    });

    it('resets the password, verifies the email, ends earlier sessions and notifies the user', async () => {
      const user = await insertUser(connection.db, {
        email: 'reset-flow@example.com',
        passwordHash,
      });
      const before = sessionTokenFrom(
        await signIn('reset-flow@example.com', PASSWORD),
      );
      await post('forgot-password', { email: 'reset-flow@example.com' });
      const token = await resetTokenSentTo('reset-flow@example.com');

      const response = await resetPassword(token);

      expect(response.status).toBe(204);
      await expect(sessions.validate(before)).resolves.toBeNull();
      expect((await signIn('reset-flow@example.com', PASSWORD)).status).toBe(
        401,
      );
      const signedIn = await signIn('reset-flow@example.com', NEW_PASSWORD);
      expect(signedIn.status).toBe(200);
      await expect(signedIn.json()).resolves.toMatchObject({
        id: user.id,
        emailVerified: true,
      });
      expect(
        emailsTo('reset-flow@example.com').map((message) => message.subject),
      ).toEqual(['Restablece tu contraseña', 'Tu contraseña cambió']);
    });

    it('does not sign the user in and clears the caller cookie', async () => {
      await insertUser(connection.db, {
        email: 'no-sign-in@example.com',
        passwordHash,
      });
      await post('forgot-password', { email: 'no-sign-in@example.com' });

      const response = await resetPassword(
        await resetTokenSentTo('no-sign-in@example.com'),
      );

      expect(response.headers.getSetCookie()).toEqual([
        `${PRODUCTION_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`,
      ]);
    });

    it('lets a Google-only user set a password', async () => {
      await insertUser(connection.db, { email: 'google-reset@example.com' });
      await post('forgot-password', { email: 'google-reset@example.com' });

      await resetPassword(await resetTokenSentTo('google-reset@example.com'));

      expect(
        (await signIn('google-reset@example.com', NEW_PASSWORD)).status,
      ).toBe(200);
    });

    it('only accepts the latest link', async () => {
      await insertUser(connection.db, {
        email: 'two-links@example.com',
        passwordHash,
      });
      await post('forgot-password', { email: 'two-links@example.com' });
      const first = await resetTokenSentTo('two-links@example.com');
      await post('forgot-password', { email: 'two-links@example.com' });
      await vi.waitFor(() =>
        expect(emailsTo('two-links@example.com')).toHaveLength(2),
      );
      const second = await resetTokenSentTo('two-links@example.com');

      expect((await resetPassword(first)).status).toBe(400);
      expect((await resetPassword(second)).status).toBe(204);
    });

    it('returns the same 400 for an expired, a used, an unknown and a malformed token', async () => {
      const user = await insertUser(connection.db, {
        email: 'bad-tokens@example.com',
        passwordHash,
      });
      const expired = 'E'.repeat(43);
      await insertAuthToken(connection.db, user.id, {
        tokenHash: hashOpaqueToken(expired),
        expiresAt: new Date(Date.now() - 1000),
      });
      await post('forgot-password', { email: 'bad-tokens@example.com' });
      const used = await resetTokenSentTo('bad-tokens@example.com');
      expect((await resetPassword(used)).status).toBe(204);

      const responses = await Promise.all(
        [expired, used, 'U'.repeat(43), 'not-a-token'].map((token) =>
          resetPassword(token, 'another long passphrase'),
        ),
      );

      const bodies = await Promise.all(responses.map(errorBody));
      for (const [index, response] of responses.entries()) {
        expect(response.status).toBe(400);
        expect(bodies[index]).toEqual({
          statusCode: 400,
          code: 'INVALID_TOKEN',
          message: 'The link is invalid or has expired',
          path: '/api/auth/reset-password',
        });
      }
      expect(
        (await signIn('bad-tokens@example.com', NEW_PASSWORD)).status,
      ).toBe(200);
    });

    it('rejects a password shorter than 15 characters', async () => {
      const response = await resetPassword('A'.repeat(43), 'only 14 chars!');

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('never puts a reset token or the new password in a response or a log', async () => {
      await insertUser(connection.db, {
        email: 'reset-leak@example.com',
        passwordHash,
      });
      const bodies = [
        await (
          await post('forgot-password', { email: 'reset-leak@example.com' })
        ).text(),
      ];
      const token = await resetTokenSentTo('reset-leak@example.com');
      bodies.push(await (await resetPassword(token)).text());
      bodies.push(await (await resetPassword(token)).text());

      const output = [...bodies, ...logger.lines].join('\n');
      expect(output).not.toContain(token);
      expect(output).not.toContain(NEW_PASSWORD);
      expect(output).not.toContain('reset-leak@example.com');
    });
  });

  it('never puts the password or its hash in a response or a log', async () => {
    await insertUser(connection.db, {
      email: 'leak@example.com',
      passwordHash,
    });

    const bodies = await Promise.all(
      [
        signIn('leak@example.com', PASSWORD),
        signIn('leak@example.com', `${PASSWORD}!`),
        signIn('nobody-else@example.com', PASSWORD),
      ].map(async (response) => (await response).text()),
    );

    const output = [...bodies, ...logger.lines].join('\n');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain(passwordHash);
    expect(output).not.toContain('$argon2id$');
  });
});
