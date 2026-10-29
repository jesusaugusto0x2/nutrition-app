import { BadRequestException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { MailDeliveryError, MailService } from '../../mail/mail.service';
import { CredentialsRepository } from '../credentials/credentials.repository';
import { hashOpaqueToken } from '../tokens/opaque-token';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';
import { PasswordHasher } from './password-hasher';
import {
  PASSWORD_RESET_TOKEN_LIFETIME_MS,
  PasswordResetService,
} from './password-reset.service';

const NOW = new Date('2026-01-10T00:00:00.000Z');
const USER = { id: '00000000-0000-4000-8000-00000000000a', name: 'Ana' };
const PASSWORD = 'correct horse battery staple';
const TOKEN = 'A'.repeat(43);

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  const credentials = { findByEmail: vi.fn(), resetPassword: vi.fn() };
  const tokens = { replace: vi.fn() };
  const passwordHasher = { hash: vi.fn() };
  const mail = { send: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: CredentialsRepository, useValue: credentials },
        { provide: AuthTokensRepository, useValue: tokens },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: MailService, useValue: mail },
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile();
    service = moduleRef.get(PasswordResetService);
  });

  describe('sendResetLink', () => {
    it('stores a hashed one-hour token and emails the raw one', async () => {
      credentials.findByEmail.mockResolvedValue({
        ...USER,
        email: 'ana@example.com',
        passwordHash: null,
      });

      await service.sendResetLink(' Ana@Example.com ');

      expect(credentials.findByEmail).toHaveBeenCalledWith('ana@example.com');
      const [stored] = tokens.replace.mock.calls[0];
      const [template, to, data] = mail.send.mock.calls[0];
      expect(template).toBe('password-reset');
      expect(to).toBe('ana@example.com');
      expect(data).toEqual({ name: 'Ana', token: expect.any(String) });
      expect(stored).toEqual({
        userId: USER.id,
        purpose: 'password_reset',
        tokenHash: hashOpaqueToken(data.token),
        expiresAt: new Date(NOW.getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS),
      });
      expect(stored.tokenHash).not.toBe(data.token);
    });

    it('does nothing for an unknown email', async () => {
      credentials.findByEmail.mockResolvedValue(undefined);

      await service.sendResetLink('nobody@example.com');

      expect(tokens.replace).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('requestReset', () => {
    it('logs a failure without the email or the error message', async () => {
      const log = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      credentials.findByEmail.mockRejectedValue(
        new Error('connection to ana@example.com failed'),
      );

      service.requestReset('ana@example.com');

      await vi.waitFor(() => expect(log).toHaveBeenCalled());
      const output = log.mock.calls.flat().join(' ');
      expect(output).toBe('Could not process a password reset request (Error)');
      log.mockRestore();
    });
  });

  describe('resetPassword', () => {
    it('stores the new hash and sends the password changed notice', async () => {
      passwordHasher.hash.mockResolvedValue('new-hash');
      credentials.resetPassword.mockResolvedValue({
        ...USER,
        email: 'ana@example.com',
      });

      await service.resetPassword(TOKEN, PASSWORD);

      expect(passwordHasher.hash).toHaveBeenCalledWith(PASSWORD);
      expect(credentials.resetPassword).toHaveBeenCalledWith({
        tokenHash: hashOpaqueToken(TOKEN),
        passwordHash: 'new-hash',
        now: NOW,
      });
      expect(mail.send).toHaveBeenCalledWith(
        'password-changed',
        'ana@example.com',
        { name: 'Ana' },
      );
    });

    it('rejects a malformed token without hashing or querying', async () => {
      await expect(
        service.resetPassword('not-a-token', PASSWORD),
      ).rejects.toThrow(BadRequestException);

      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(credentials.resetPassword).not.toHaveBeenCalled();
    });

    it('fails identically for a malformed and a rejected token', async () => {
      credentials.resetPassword.mockResolvedValue(undefined);

      const errors = await Promise.all(
        ['not-a-token', TOKEN].map((token) =>
          service
            .resetPassword(token, PASSWORD)
            .catch((error: BadRequestException) => error.getResponse()),
        ),
      );

      expect(errors[0]).toEqual({
        code: 'INVALID_TOKEN',
        message: 'The link is invalid or has expired',
      });
      expect(errors[1]).toEqual(errors[0]);
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('keeps the new password when the notice cannot be sent', async () => {
      const log = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      credentials.resetPassword.mockResolvedValue({
        ...USER,
        email: 'ana@example.com',
      });
      mail.send.mockRejectedValue(
        new MailDeliveryError('password-changed', 'ECONNECTION'),
      );

      await expect(
        service.resetPassword(TOKEN, PASSWORD),
      ).resolves.toBeUndefined();
      expect(log.mock.calls.flat().join(' ')).not.toContain('ana@example.com');
      log.mockRestore();
    });
  });
});
