import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { MailService } from '../../mail/mail.service';
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

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  const tokens = { replace: vi.fn() };
  const mail = { send: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
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
});
