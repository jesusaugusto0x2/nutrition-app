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
import { users } from '../database/schema';
import { insertUser } from '../database/testing/fixtures';
import { createTestDatabase } from '../database/testing/test-database';
import { AuthModule } from './auth.module';
import { PASSWORD_HASH_OPTIONS } from './passwords/password-hash-options';
import { PasswordHasher } from './passwords/password-hasher';
import { PRODUCTION_SESSION_COOKIE } from './sessions/session-cookie';
import { SessionsService } from './sessions/sessions.service';

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
        { provide: APP_CONFIG, useValue: { NODE_ENV: 'production' } },
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
    }).compile();

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
