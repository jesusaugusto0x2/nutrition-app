import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { MailService } from '../../mail/mail.service';
import { CredentialsRepository } from '../credentials/credentials.repository';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';
import { hashOpaqueToken } from '../tokens/opaque-token';
import {
  EMAIL_VERIFICATION_TOKEN_LIFETIME_MS,
  EmailVerificationService,
} from './email-verification.service';

const NOW = new Date('2026-01-10T00:00:00.000Z');
const USER = {
  id: '00000000-0000-4000-8000-00000000000a',
  email: 'ana@example.com',
  name: 'Ana',
};
const WELL_FORMED_TOKEN = 'A'.repeat(43);

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  const credentials = { findByEmail: vi.fn(), verifyEmail: vi.fn() };
  const tokens = { replace: vi.fn() };
  const mail = { send: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: CredentialsRepository, useValue: credentials },
        { provide: AuthTokensRepository, useValue: tokens },
        { provide: MailService, useValue: mail },
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile();
    service = moduleRef.get(EmailVerificationService);
  });

  it('stores a hashed 24-hour token and emails the raw one', async () => {
    await service.sendLink(USER);

    const [stored] = tokens.replace.mock.calls[0];
    const [template, to, data] = mail.send.mock.calls[0];
    expect(template).toBe('email-verification');
    expect(to).toBe('ana@example.com');
    expect(data).toEqual({ name: 'Ana', token: expect.any(String) });
    expect(stored).toEqual({
      userId: USER.id,
      purpose: 'email_verification',
      tokenHash: hashOpaqueToken(data.token),
      expiresAt: new Date(NOW.getTime() + EMAIL_VERIFICATION_TOKEN_LIFETIME_MS),
    });
    expect(stored.tokenHash).not.toBe(data.token);
  });

  it('sends nothing when the token cannot be stored', async () => {
    tokens.replace.mockRejectedValue(new Error('database down'));

    await expect(service.sendLink(USER)).rejects.toThrow('database down');

    expect(mail.send).not.toHaveBeenCalled();
  });

  describe('resendLink', () => {
    it('emails a new link to an unverified account, found by normalized email', async () => {
      credentials.findByEmail.mockResolvedValue({
        ...USER,
        emailVerifiedAt: null,
        passwordHash: 'stored-hash',
      });

      await service.resendLink(' Ana@Example.COM ');

      expect(credentials.findByEmail).toHaveBeenCalledWith('ana@example.com');
      expect(tokens.replace).toHaveBeenCalledTimes(1);
      expect(mail.send).toHaveBeenCalledTimes(1);
    });

    it('does nothing for a verified account', async () => {
      credentials.findByEmail.mockResolvedValue({
        ...USER,
        emailVerifiedAt: NOW,
        passwordHash: 'stored-hash',
      });

      await service.resendLink('ana@example.com');

      expect(tokens.replace).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('does nothing for an unknown email', async () => {
      credentials.findByEmail.mockResolvedValue(undefined);

      await service.resendLink('nobody@example.com');

      expect(tokens.replace).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('requestResend', () => {
    it('does not reject when the work fails', async () => {
      credentials.findByEmail.mockRejectedValue(new Error('database down'));

      expect(() => service.requestResend('ana@example.com')).not.toThrow();

      await vi.waitFor(() =>
        expect(credentials.findByEmail).toHaveBeenCalled(),
      );
    });
  });

  describe('verify', () => {
    it('verifies by token hash and returns the user', async () => {
      credentials.verifyEmail.mockResolvedValue({
        ...USER,
        emailVerifiedAt: NOW,
      });

      await expect(service.verify(WELL_FORMED_TOKEN)).resolves.toEqual({
        ...USER,
        emailVerified: true,
      });

      expect(credentials.verifyEmail).toHaveBeenCalledWith({
        tokenHash: hashOpaqueToken(WELL_FORMED_TOKEN),
        now: NOW,
      });
    });

    it('rejects a malformed token without querying', async () => {
      await expect(service.verify('not-a-token')).rejects.toThrow(
        BadRequestException,
      );

      expect(credentials.verifyEmail).not.toHaveBeenCalled();
    });

    it('rejects a token the repository does not accept', async () => {
      credentials.verifyEmail.mockResolvedValue(undefined);

      const error: unknown = await service
        .verify(WELL_FORMED_TOKEN)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        code: 'INVALID_TOKEN',
        message: 'The link is invalid or has expired',
      });
    });
  });
});
