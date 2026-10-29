import type { MailMessage, MailTransport } from '../mail-transport';

/**
 * In-memory transport for tests: records every message instead of sending
 * it. Provide it as `MAIL_TRANSPORT`.
 */
export class FakeMailTransport implements MailTransport {
  readonly sent: MailMessage[] = [];
  private failure: unknown;

  async send(message: MailMessage): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.sent.push(message);
  }

  /** Makes every following `send` reject with `error`. */
  failWith(error: unknown): void {
    this.failure = error;
  }
}
