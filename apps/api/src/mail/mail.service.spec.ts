import { Test } from '@nestjs/testing';
import { APP_CONFIG, loadConfig } from '../config/app-config';
import { MAIL_TRANSPORT } from './mail-transport';
import { MailDeliveryError, MailService } from './mail.service';
import { FakeMailTransport } from './testing/fake-mail-transport';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:password@localhost:5432/db',
  MAIL_FROM: 'Mi consulta <no-reply@example.com>',
  APP_ORIGIN: 'https://app.example.com',
});

describe('MailService', () => {
  let service: MailService;
  let transport: FakeMailTransport;

  beforeEach(async () => {
    transport = new FakeMailTransport();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MAIL_TRANSPORT, useValue: transport },
        { provide: APP_CONFIG, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(MailService);
  });

  it('sends the rendered template from MAIL_FROM to the recipient', async () => {
    await service.send('email-verification', 'ana@example.com', {
      name: 'Ana',
      token: 'token-123',
    });

    expect(transport.sent).toHaveLength(1);
    const [message] = transport.sent;
    expect(message).toMatchObject({
      from: 'Mi consulta <no-reply@example.com>',
      to: 'ana@example.com',
      subject: 'Confirma tu correo electrónico',
    });
    expect(message.text).toContain(
      'https://app.example.com/verify-email?token=token-123',
    );
    expect(message.html).toContain('<html lang="es">');
  });

  it('hides the transport error message, keeping only its code', async () => {
    const smtpError = Object.assign(
      new Error('550 Mailbox ana@example.com rejected'),
      { code: 'EENVELOPE' },
    );
    transport.failWith(smtpError);

    const sending = service.send('password-changed', 'ana@example.com', {
      name: 'Ana',
    });

    await expect(sending).rejects.toBeInstanceOf(MailDeliveryError);
    const error = (await sending.catch((caught: unknown) => caught)) as Error;
    expect(error.message).toBe(
      'Could not send the "password-changed" email (EENVELOPE)',
    );
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('ana@example.com');
  });

  it('ignores codes that are not plain identifiers', async () => {
    transport.failWith({ code: 'rejected ana@example.com' });

    const error = (await service
      .send('password-changed', 'ana@example.com', { name: 'Ana' })
      .catch((caught: unknown) => caught)) as MailDeliveryError;

    expect(error.transportCode).toBeUndefined();
    expect(error.message).not.toContain('ana@example.com');
  });
});
