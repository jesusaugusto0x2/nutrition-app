import { createTransport } from 'nodemailer';

/** A rendered email, ready to hand to a transport. */
export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Delivers rendered emails. Production and development use SMTP; tests
 * inject a fake (`mail/testing`).
 */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export interface SmtpTransportOptions {
  /** `smtp://` or `smtps://` URL, credentials included. */
  url: string;
  /**
   * Refuse to send over a plain connection: an `smtp://` URL must upgrade
   * with STARTTLS. Set in production; Mailpit in development has no TLS.
   */
  requireTls: boolean;
}

export function createSmtpTransport({
  url,
  requireTls,
}: SmtpTransportOptions): MailTransport {
  const transporter = createTransport({
    url,
    requireTLS: requireTls,
    // nodemailer's own logging would print recipients and message content.
    logger: false,
    debug: false,
  });
  return {
    async send(message) {
      await transporter.sendMail(message);
    },
  };
}
