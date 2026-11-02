import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { TransactionRunner } from '../../database/transaction-runner';
import { AuthAccountsRepository } from '../accounts/auth-accounts.repository';
import { CredentialsRepository } from '../credentials/credentials.repository';
import {
  GoogleAuthService,
  GoogleSignInError,
  isGoogleAuthoritative,
} from './google-auth.service';
import { type GoogleIdentity, GoogleOidcClient } from './google-oidc.client';

const NOW = new Date('2026-11-01T12:00:00.000Z');
const TX = { transaction: true };
const EXTERNAL = { provider: 'google', providerAccountId: 'google-sub' };

const checks = { state: 'the-state', nonce: 'the-nonce', codeVerifier: 'v' };
const callbackQuery = 'code=the-code&state=the-state';

const gmailIdentity: GoogleIdentity = {
  sub: 'google-sub',
  email: 'Ana@Gmail.com',
  emailVerified: true,
  name: 'Ana Torres',
};

const storedUser = {
  id: 'existing-user',
  email: 'ana@gmail.com',
  name: 'Ana',
  passwordHash: 'stored-hash',
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('GoogleAuthService', () => {
  const oidc = {
    configured: true,
    createAuthorizationRequest: vi.fn(),
    exchangeCode: vi.fn(),
  };
  const accounts = { findUserId: vi.fn(), link: vi.fn() };
  const credentials = {
    findByEmailForUpdate: vi.fn(),
    createVerified: vi.fn(),
    takeOverUnverified: vi.fn(),
  };
  let service: GoogleAuthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    oidc.exchangeCode.mockResolvedValue(gmailIdentity);
    accounts.findUserId.mockResolvedValue(undefined);
    credentials.findByEmailForUpdate.mockResolvedValue(undefined);
    credentials.createVerified.mockResolvedValue({ id: 'new-user' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: GoogleOidcClient, useValue: oidc },
        { provide: AuthAccountsRepository, useValue: accounts },
        { provide: CredentialsRepository, useValue: credentials },
        {
          provide: TransactionRunner,
          useValue: {
            run: (work: (tx: unknown) => Promise<unknown>) => work(TX),
          },
        },
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile();
    service = moduleRef.get(GoogleAuthService);
  });

  describe('finish: checks before the account', () => {
    it.each([
      ['a wrong state', 'code=the-code&state=forged', checks],
      ['a missing state', 'code=the-code', checks],
      ['no flow cookie', callbackQuery, null],
    ])('rejects %s without calling Google', async (_case, query, flow) => {
      await expect(service.finish(query, flow)).rejects.toMatchObject({
        reason: 'state-mismatch',
      });

      expect(oidc.exchangeCode).not.toHaveBeenCalled();
    });

    it('rejects an email Google has not verified, before touching an account', async () => {
      oidc.exchangeCode.mockResolvedValue({
        ...gmailIdentity,
        emailVerified: false,
      });

      await expect(service.finish(callbackQuery, checks)).rejects.toMatchObject(
        { reason: 'email-not-verified' },
      );

      expect(accounts.findUserId).not.toHaveBeenCalled();
      expect(accounts.link).not.toHaveBeenCalled();
    });

    it('lets errors from Google through', async () => {
      oidc.exchangeCode.mockRejectedValue(new TypeError('invalid response'));

      await expect(service.finish(callbackQuery, checks)).rejects.toThrow(
        TypeError,
      );
    });
  });

  describe('finish: a linked account', () => {
    it('signs in the linked user', async () => {
      accounts.findUserId.mockResolvedValue('linked-user');

      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'linked-user',
        created: false,
      });
      expect(accounts.findUserId).toHaveBeenCalledWith(EXTERNAL, TX);
    });

    it('matches by sub, never by email, once linked', async () => {
      accounts.findUserId.mockResolvedValue('linked-user');
      oidc.exchangeCode.mockResolvedValue({
        ...gmailIdentity,
        email: 'someone-else@gmail.com',
      });

      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'linked-user',
        created: false,
      });
      expect(credentials.findByEmailForUpdate).not.toHaveBeenCalled();
      expect(accounts.link).not.toHaveBeenCalled();
    });
  });

  describe('finish: an existing email', () => {
    it('links a verified user and leaves the password alone', async () => {
      credentials.findByEmailForUpdate.mockResolvedValue(storedUser);

      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'existing-user',
        created: false,
      });

      expect(credentials.findByEmailForUpdate).toHaveBeenCalledWith(
        'ana@gmail.com',
        TX,
      );
      expect(accounts.link).toHaveBeenCalledWith('existing-user', EXTERNAL, TX);
      expect(credentials.takeOverUnverified).not.toHaveBeenCalled();
      expect(credentials.createVerified).not.toHaveBeenCalled();
    });

    it('takes over an unverified user before linking it', async () => {
      credentials.findByEmailForUpdate.mockResolvedValue({
        ...storedUser,
        emailVerifiedAt: null,
      });

      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'existing-user',
        created: false,
      });

      expect(credentials.takeOverUnverified).toHaveBeenCalledWith(
        'existing-user',
        NOW,
        TX,
      );
      expect(accounts.link).toHaveBeenCalledWith('existing-user', EXTERNAL, TX);
    });

    it.each([
      ['verified', storedUser.emailVerifiedAt],
      ['unverified', null],
    ])(
      'refuses a %s user when Google is not authoritative for the email',
      async (_case, emailVerifiedAt) => {
        credentials.findByEmailForUpdate.mockResolvedValue({
          ...storedUser,
          email: 'ana@outlook.com',
          emailVerifiedAt,
        });
        oidc.exchangeCode.mockResolvedValue({
          ...gmailIdentity,
          email: 'ana@outlook.com',
        });

        const failure = service.finish(callbackQuery, checks);

        await expect(failure).rejects.toBeInstanceOf(GoogleSignInError);
        await expect(failure).rejects.toMatchObject({
          reason: 'email-not-authoritative',
        });
        expect(credentials.takeOverUnverified).not.toHaveBeenCalled();
        expect(accounts.link).not.toHaveBeenCalled();
      },
    );

    it('links a Workspace account on its own domain', async () => {
      credentials.findByEmailForUpdate.mockResolvedValue(storedUser);
      oidc.exchangeCode.mockResolvedValue({
        ...gmailIdentity,
        email: 'ana@clinic.example',
        hostedDomain: 'clinic.example',
      });

      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'existing-user',
        created: false,
      });
    });
  });

  describe('finish: a new person', () => {
    it('creates a verified user without a password and links it', async () => {
      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'new-user',
        created: true,
      });

      expect(credentials.createVerified).toHaveBeenCalledWith(
        {
          email: 'ana@gmail.com',
          name: 'Ana Torres',
          emailVerifiedAt: NOW,
        },
        TX,
      );
      expect(accounts.link).toHaveBeenCalledWith('new-user', EXTERNAL, TX);
    });

    it.each([
      ['no', undefined],
      ['a blank', '   '],
    ])('uses the email when Google sends %s name', async (_case, name) => {
      oidc.exchangeCode.mockResolvedValue({ ...gmailIdentity, name });

      await service.finish(callbackQuery, checks);

      expect(credentials.createVerified).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'ana@gmail.com' }),
        TX,
      );
    });

    it('accepts a third-party email, which has no account to protect', async () => {
      oidc.exchangeCode.mockResolvedValue({
        ...gmailIdentity,
        email: 'ana@outlook.com',
      });

      await expect(service.finish(callbackQuery, checks)).resolves.toEqual({
        userId: 'new-user',
        created: true,
      });
    });
  });
});

describe('isGoogleAuthoritative', () => {
  it.each([
    ['a Gmail address', { email: 'ana@gmail.com' }, true],
    ['Gmail in any letter case', { email: 'Ana@GMAIL.com' }, true],
    [
      'a Workspace account',
      { email: 'ana@clinic.example', hostedDomain: 'clinic.example' },
      true,
    ],
    ['a third-party address', { email: 'ana@outlook.com' }, false],
    ['a look-alike domain', { email: 'ana@notgmail.com' }, false],
    ['a Gmail subdomain', { email: 'ana@gmail.com.evil.example' }, false],
  ])('for %s', (_case, identity, expected) => {
    expect(isGoogleAuthoritative(identity)).toBe(expected);
  });
});
