import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport';
import {
  type MailTemplate,
  type MailTemplateData,
  renderMail,
} from './mail-templates';

/**
 * An email could not be delivered. Carries only the template and the
 * transport's error code: SMTP error messages can echo the recipient or the
 * message, which must never reach the logs.
 */
export class MailDeliveryError extends Error {
  override readonly name = 'MailDeliveryError';

  constructor(
    readonly template: MailTemplate,
    readonly transportCode: string | undefined,
  ) {
    super(
      `Could not send the "${template}" email${transportCode ? ` (${transportCode})` : ''}`,
    );
  }
}

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Renders `template` and sends it to `to`. Throws `MailDeliveryError` when
   * the transport fails; callers decide whether that fails their request.
   */
  async send<T extends MailTemplate>(
    template: T,
    to: string,
    data: MailTemplateData[T],
  ): Promise<void> {
    const rendered = renderMail(template, data, this.config.APP_ORIGIN);
    try {
      await this.transport.send({
        from: this.config.MAIL_FROM,
        to,
        ...rendered,
      });
    } catch (error) {
      throw new MailDeliveryError(template, transportCode(error));
    }
  }
}

function transportCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    // nodemailer codes such as EAUTH, ECONNECTION or EENVELOPE.
    return typeof code === 'string' && /^[A-Z_]+$/.test(code)
      ? code
      : undefined;
  }
  return undefined;
}
