import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { createSmtpTransport, MAIL_TRANSPORT } from './mail-transport';
import { MailService } from './mail.service';

/** Transactional email. Import it where emails are sent (e.g. AuthModule). */
@Module({
  providers: [
    MailService,
    {
      provide: MAIL_TRANSPORT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createSmtpTransport({
          url: config.SMTP_URL,
          requireTls: config.NODE_ENV === 'production',
        }),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
