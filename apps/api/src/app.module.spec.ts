import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorSchema, type AuthUser } from '@nutri/schemas';
import cookieParser from 'cookie-parser';
import { eq } from 'drizzle-orm';
import { AppModule } from './app.module';
import { PasswordHasher } from './auth/passwords/password-hasher';
import { DEVELOPMENT_SESSION_COOKIE } from './auth/sessions/session-cookie';
import { SessionsService } from './auth/sessions/sessions.service';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { PortalAccess } from './common/decorators/portal-access.decorator';
import { PortalPatientIds } from './common/decorators/portal-patient-ids.decorator';
import { APP_CONFIG } from './config/app-config';
import type { DatabaseConnection } from './database/client';
import { DATABASE_CONNECTION } from './database/database.tokens';
import { patients } from './database/schema';
import {
  insertClinic,
  insertConsultation,
  insertMembership,
  insertPatient,
  insertPatientAccess,
  insertUser,
} from './database/testing/fixtures';
import { createTestDatabase } from './database/testing/test-database';
import { MAIL_TRANSPORT } from './mail/mail-transport';
import { FakeMailTransport } from './mail/testing/fake-mail-transport';

const PASSWORD = 'correct horse battery staple';
const UNKNOWN_ID = '00000000-0000-4000-8000-0000000000ff';

// No real route uses these yet: one has no access decorator at all, and the
// portal has no endpoints.
@Controller('test-probe')
class ProbeController {
  @Get('session-only')
  sessionOnly(@CurrentUser() user: AuthUser) {
    return { userId: user.id };
  }

  @PortalAccess()
  @Get('portal')
  portal(@PortalPatientIds() patientIds: string[]) {
    return { patientIds };
  }
}

/** The whole application, through its real guards, on an in-process database. */
describe('AppModule', () => {
  let connection: DatabaseConnection;
  let app: INestApplication;
  let baseUrl: string;
  let sessions: SessionsService;
  let passwordHash: string;

  beforeAll(async () => {
    connection = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue({
        NODE_ENV: 'test',
        APP_ORIGIN: 'https://app.example.com',
        MAIL_FROM: 'Mi consulta <no-reply@example.com>',
        CLIENT_IP_SOURCE: 'socket',
      })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(connection)
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(new FakeMailTransport())
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    sessions = moduleRef.get(SessionsService);
    passwordHash = await moduleRef.get(PasswordHasher).hash(PASSWORD);
  });

  afterAll(async () => {
    // Also closes the connection, through DatabaseModule's shutdown hook.
    await app.close();
  });

  function request(path: string, token?: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}/api/${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token && { cookie: `${DEVELOPMENT_SESSION_COOKIE}=${token}` }),
      },
    });
  }

  async function errorCode(response: Response) {
    return apiErrorSchema.parse(await response.json()).code;
  }

  async function signedIn(userId: string): Promise<string> {
    return (await sessions.create(userId, 'Test agent')).token;
  }

  /** A staff user of a new clinic, signed in. */
  async function staffUser() {
    const clinic = await insertClinic(connection.db);
    const user = await insertUser(connection.db);
    await insertMembership(connection.db, user.id, clinic.id);
    return { clinic, user, token: await signedIn(user.id) };
  }

  /** A signed-in user with access to a patient and no membership. */
  async function portalUser() {
    const clinic = await insertClinic(connection.db);
    const patient = await insertPatient(connection.db, clinic.id);
    const user = await insertUser(connection.db);
    await insertPatientAccess(connection.db, user.id, patient.id);
    return { patient, user, token: await signedIn(user.id) };
  }

  describe('without a session', () => {
    it('answers 401 on clinic routes', async () => {
      const response = await request('clinic/patients');

      expect(response.status).toBe(401);
      await expect(errorCode(response)).resolves.toBe('UNAUTHORIZED');
    });

    it('answers 401 on every clinic route shape', async () => {
      const statuses = await Promise.all([
        request(`clinic/patients/${UNKNOWN_ID}`).then((r) => r.status),
        request(`clinic/patients/${UNKNOWN_ID}/consultations`).then(
          (r) => r.status,
        ),
        request('clinic/patients', undefined, {
          method: 'POST',
          body: '{}',
        }).then((r) => r.status),
      ]);

      expect(statuses).toEqual([401, 401, 401]);
    });

    it('answers 401 on a route with no access decorator', async () => {
      const response = await request('test-probe/session-only');

      expect(response.status).toBe(401);
    });

    it('answers 401 on portal routes', async () => {
      const response = await request('test-probe/portal');

      expect(response.status).toBe(401);
    });

    it('serves the health check', async () => {
      const response = await request('health');

      expect(response.status).toBe(200);
    });

    it('still answers 404 for unknown routes', async () => {
      const response = await request('does-not-exist');

      expect(response.status).toBe(404);
    });

    it('lets the public auth routes through', async () => {
      const post = (path: string, body: unknown) =>
        request(`auth/${path}`, undefined, {
          method: 'POST',
          body: JSON.stringify(body),
        }).then((response) => response.status);

      await expect(post('sign-out', {})).resolves.toBe(204);
      await expect(
        post('forgot-password', { email: 'nobody@example.com' }),
      ).resolves.toBe(202);
      await expect(
        post('sign-in', { email: 'nobody@example.com', password: PASSWORD }),
      ).resolves.toBe(401);
      // Reaches the handler: the guard would not look at the body.
      await expect(post('reset-password', {})).resolves.toBe(400);
    });
  });

  describe('with a session cookie', () => {
    it('rejects a token that is not a session', async () => {
      const response = await request('clinic/patients', 'a'.repeat(43));

      expect(response.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const response = await request('clinic/patients', 'not-a-token');

      expect(response.status).toBe(401);
    });

    it('rejects a revoked session', async () => {
      const { token } = await staffUser();
      await sessions.revokeByToken(token);

      const response = await request('clinic/patients', token);

      expect(response.status).toBe(401);
    });

    it('accepts the cookie set by signing in', async () => {
      const clinic = await insertClinic(connection.db);
      const patient = await insertPatient(connection.db, clinic.id);
      const user = await insertUser(connection.db, { passwordHash });
      await insertMembership(connection.db, user.id, clinic.id);

      const signIn = await request('auth/sign-in', undefined, {
        method: 'POST',
        body: JSON.stringify({ email: user.email, password: PASSWORD }),
      });
      const cookie = signIn.headers.getSetCookie()[0];
      const token = cookie.split(';')[0].split('=')[1];
      const response = await request('clinic/patients', token);

      expect(signIn.status).toBe(200);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        expect.objectContaining({ id: patient.id }),
      ]);
    });

    it('exposes the user through @CurrentUser()', async () => {
      const { user, token } = await staffUser();

      const response = await request('test-probe/session-only', token);

      await expect(response.json()).resolves.toEqual({ userId: user.id });
    });
  });

  describe('clinic isolation', () => {
    it('lists only the patients of the clinic of the user', async () => {
      const { clinic, token } = await staffUser();
      const own = await insertPatient(connection.db, clinic.id);
      const other = await staffUser();
      await insertPatient(connection.db, other.clinic.id);

      const response = await request('clinic/patients', token);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        expect.objectContaining({ id: own.id }),
      ]);
    });

    it("gets 404 for another clinic's patient", async () => {
      const { clinic, token } = await staffUser();
      const own = await insertPatient(connection.db, clinic.id);
      const other = await staffUser();
      const foreign = await insertPatient(connection.db, other.clinic.id);

      const ownResponse = await request(`clinic/patients/${own.id}`, token);
      const foreignResponse = await request(
        `clinic/patients/${foreign.id}`,
        token,
      );

      expect(ownResponse.status).toBe(200);
      expect(foreignResponse.status).toBe(404);
    });

    it("answers exactly as for a missing patient on another clinic's id", async () => {
      const { token } = await staffUser();
      const other = await staffUser();
      const foreign = await insertPatient(connection.db, other.clinic.id);

      const foreignResponse = await request(
        `clinic/patients/${foreign.id}`,
        token,
      );
      const missingResponse = await request(
        `clinic/patients/${UNKNOWN_ID}`,
        token,
      );

      expect(foreignResponse.status).toBe(missingResponse.status);
      await expect(errorCode(foreignResponse)).resolves.toBe(
        await errorCode(missingResponse),
      );
    });

    it("cannot update another clinic's patient", async () => {
      const { token } = await staffUser();
      const other = await staffUser();
      const foreign = await insertPatient(connection.db, other.clinic.id, {
        firstName: 'Original',
      });

      const response = await request(`clinic/patients/${foreign.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Changed' }),
      });
      const [row] = await connection.db
        .select({ firstName: patients.firstName })
        .from(patients)
        .where(eq(patients.id, foreign.id));

      expect(response.status).toBe(404);
      expect(row.firstName).toBe('Original');
    });

    it("cannot read another clinic's consultations", async () => {
      const { token } = await staffUser();
      const other = await staffUser();
      const foreign = await insertPatient(connection.db, other.clinic.id);
      await insertConsultation(connection.db, other.clinic.id, foreign.id);

      const response = await request(
        `clinic/patients/${foreign.id}/consultations`,
        token,
      );

      expect(response.status).toBe(404);
    });
  });

  describe('clinic access', () => {
    it('answers 403 to a portal-only user', async () => {
      const { token } = await portalUser();

      const response = await request('clinic/patients', token);

      expect(response.status).toBe(403);
      await expect(errorCode(response)).resolves.toBe('FORBIDDEN');
    });

    it('answers 403 to a user with neither a membership nor portal access', async () => {
      const user = await insertUser(connection.db);

      const response = await request(
        'clinic/patients',
        await signedIn(user.id),
      );

      expect(response.status).toBe(403);
    });

    it('does not reach the handler when the user has no membership', async () => {
      const { patient, token } = await portalUser();

      const response = await request(`clinic/patients/${patient.id}`, token);

      expect(response.status).toBe(403);
    });
  });

  describe('portal access', () => {
    it('answers 403 to a staff user without patient access', async () => {
      const { token } = await staffUser();

      const response = await request('test-probe/portal', token);

      expect(response.status).toBe(403);
      await expect(errorCode(response)).resolves.toBe('FORBIDDEN');
    });

    it('exposes only the patients of the user', async () => {
      const { patient, token } = await portalUser();
      await portalUser();

      const response = await request('test-probe/portal', token);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        patientIds: [patient.id],
      });
    });

    it('answers 403 when the only patient of the user was soft-deleted', async () => {
      const { patient, token } = await portalUser();
      await connection.db
        .update(patients)
        .set({ deletedAt: new Date() })
        .where(eq(patients.id, patient.id));

      const response = await request('test-probe/portal', token);

      expect(response.status).toBe(403);
    });

    it('allows a staff user who also has patient access', async () => {
      const { user, token } = await staffUser();
      const other = await staffUser();
      const patient = await insertPatient(connection.db, other.clinic.id);
      await insertPatientAccess(connection.db, user.id, patient.id);

      const response = await request('test-probe/portal', token);

      await expect(response.json()).resolves.toEqual({
        patientIds: [patient.id],
      });
    });
  });
});
