import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { clinics, memberships, users } from '../../database/schema';
import { insertUser } from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { TransactionRunner } from '../../database/transaction-runner';
import { MailDeliveryError, MailService } from '../../mail/mail.service';
import { ClinicsRepository } from '../../modules/clinics/clinics.repository';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { MembershipsRepository } from '../../modules/clinics/memberships.repository';
import { CredentialsRepository } from '../credentials/credentials.repository';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { PasswordHasher } from '../passwords/password-hasher';
import { SignUpService } from './sign-up.service';

const PASSWORD = 'correct horse battery staple';

// Real repositories on PGlite: what matters here is what is committed.
describe('SignUpService', () => {
  let connection: DatabaseConnection;
  let service: SignUpService;
  let clinicsRepository: ClinicsRepository;
  let membershipsRepository: MembershipsRepository;
  const passwordHasher = { hash: vi.fn() };
  const emailVerification = { sendLink: vi.fn() };
  const mail = { send: vi.fn() };

  let emailCount = 0;
  function nextEmail(): string {
    emailCount += 1;
    return `sign-up-${emailCount}@example.com`;
  }

  function input(email: string) {
    return {
      name: 'Ana Torres',
      email,
      password: PASSWORD,
      clinicName: 'Consultorio Ana',
    };
  }

  function usersWith(email: string) {
    return connection.db.select().from(users).where(eq(users.email, email));
  }

  /** To see that a sign-up that created nothing left no clinic behind. */
  async function clinicCount(): Promise<number> {
    return connection.db.$count(clinics);
  }

  beforeAll(async () => {
    connection = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SignUpService,
        ClinicsService,
        ClinicsRepository,
        MembershipsRepository,
        CredentialsRepository,
        TransactionRunner,
        { provide: DATABASE, useValue: connection.db },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: EmailVerificationService, useValue: emailVerification },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = moduleRef.get(SignUpService);
    clinicsRepository = moduleRef.get(ClinicsRepository);
    membershipsRepository = moduleRef.get(MembershipsRepository);
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    passwordHasher.hash.mockResolvedValue('hashed-password');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signUp', () => {
    it('creates the unverified user, their clinic and an owner membership', async () => {
      const email = nextEmail();

      await service.signUp(input(email));

      const [user] = await usersWith(email);
      expect(user).toMatchObject({
        name: 'Ana Torres',
        passwordHash: 'hashed-password',
        emailVerifiedAt: null,
      });
      expect(passwordHasher.hash).toHaveBeenCalledWith(PASSWORD);
      await expect(
        connection.db
          .select({ role: memberships.role, clinicName: clinics.name })
          .from(memberships)
          .innerJoin(clinics, eq(clinics.id, memberships.clinicId))
          .where(eq(memberships.userId, user.id)),
      ).resolves.toEqual([{ role: 'owner', clinicName: 'Consultorio Ana' }]);
    });

    it('normalizes the email before storing it', async () => {
      const email = nextEmail();

      await service.signUp(input(` ${email.toUpperCase()} `));

      await expect(usersWith(email)).resolves.toHaveLength(1);
    });

    it('gives each sign-up its own clinic', async () => {
      const [first, second] = [nextEmail(), nextEmail()];

      await service.signUp(input(first));
      await service.signUp(input(second));

      const rows = await connection.db
        .select({ clinicId: memberships.clinicId })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(inArray(users.email, [first, second]));
      expect(new Set(rows.map((row) => row.clinicId)).size).toBe(2);
    });

    it('sends a verification link to a new email, after creating the account', async () => {
      const email = nextEmail();
      emailVerification.sendLink.mockImplementation(async () => {
        await expect(usersWith(email)).resolves.toHaveLength(1);
      });

      await service.signUp(input(email));

      const [user] = await usersWith(email);
      expect(emailVerification.sendLink).toHaveBeenCalledExactlyOnceWith({
        id: user.id,
        email,
        name: 'Ana Torres',
      });
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('notifies the owner of an existing email and changes nothing', async () => {
      const email = nextEmail();
      const existing = await insertUser(connection.db, {
        email,
        name: 'Stored name',
        passwordHash: 'original-hash',
      });
      const clinicsBefore = await clinicCount();

      await service.signUp({ ...input(email), name: 'Someone else' });

      await expect(usersWith(email)).resolves.toEqual([existing]);
      expect(await clinicCount()).toBe(clinicsBefore);
      expect(mail.send).toHaveBeenCalledExactlyOnceWith(
        'sign-up-attempt',
        email,
        { name: 'Stored name' },
      );
      expect(emailVerification.sendLink).not.toHaveBeenCalled();
    });

    it('notifies a Google-only account too', async () => {
      const email = nextEmail();
      await insertUser(connection.db, { email, name: 'Google user' });

      await service.signUp(input(email));

      expect(mail.send).toHaveBeenCalledExactlyOnceWith(
        'sign-up-attempt',
        email,
        { name: 'Google user' },
      );
    });

    it('creates one account for two concurrent sign-ups with the same email', async () => {
      const email = nextEmail();
      const clinicsBefore = await clinicCount();

      await Promise.all([
        service.signUp(input(email)),
        service.signUp(input(email)),
      ]);

      await expect(usersWith(email)).resolves.toHaveLength(1);
      expect(await clinicCount()).toBe(clinicsBefore + 1);
      expect(emailVerification.sendLink).toHaveBeenCalledOnce();
      expect(mail.send).toHaveBeenCalledOnce();
    });

    it('creates nothing when the clinic cannot be created', async () => {
      const email = nextEmail();
      const clinicsBefore = await clinicCount();
      vi.spyOn(clinicsRepository, 'create').mockRejectedValueOnce(
        new Error('clinic failed'),
      );

      await expect(service.signUp(input(email))).rejects.toThrow(
        'clinic failed',
      );

      await expect(usersWith(email)).resolves.toEqual([]);
      expect(await clinicCount()).toBe(clinicsBefore);
      expect(emailVerification.sendLink).not.toHaveBeenCalled();
    });

    it('creates nothing when the membership cannot be created', async () => {
      const email = nextEmail();
      const clinicsBefore = await clinicCount();
      vi.spyOn(membershipsRepository, 'create').mockRejectedValueOnce(
        new Error('membership failed'),
      );

      await expect(service.signUp(input(email))).rejects.toThrow(
        'membership failed',
      );

      await expect(usersWith(email)).resolves.toEqual([]);
      expect(await clinicCount()).toBe(clinicsBefore);
      expect(emailVerification.sendLink).not.toHaveBeenCalled();
    });

    it('keeps the account when the email cannot be delivered', async () => {
      const email = nextEmail();
      emailVerification.sendLink.mockRejectedValue(
        new MailDeliveryError('email-verification', 'ECONNECTION'),
      );

      await expect(service.signUp(input(email))).rejects.toThrow(
        MailDeliveryError,
      );

      await expect(usersWith(email)).resolves.toHaveLength(1);
    });
  });

  describe('requestSignUp', () => {
    it('logs a failure without the request data or the error message', async () => {
      const log = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      passwordHasher.hash.mockRejectedValue(
        new Error(`cannot process ${PASSWORD}`),
      );

      service.requestSignUp(input('leak@example.com'));

      await vi.waitFor(() => expect(log).toHaveBeenCalled());
      expect(log.mock.calls.flat().join(' ')).toBe(
        'Could not process a sign-up request (Error)',
      );
    });
  });
});
