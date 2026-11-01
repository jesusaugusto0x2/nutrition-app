import { Inject, Injectable, Logger } from '@nestjs/common';
import { type AuthUser, normalizeEmail } from '@nutri/schemas';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { MailService } from '../../mail/mail.service';
import {
  CredentialsRepository,
  type UserRecipientRow,
} from '../credentials/credentials.repository';
import { toAuthUser } from '../sessions/sessions.mapper';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';
import { invalidToken } from '../tokens/invalid-token';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  isWellFormedOpaqueToken,
} from '../tokens/opaque-token';

/** A verification link stops working this long after it is emailed. */
export const EMAIL_VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokensRepository,
    private readonly mail: MailService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Emails a verification link. Replaces any earlier link. */
  async sendLink(user: UserRecipientRow): Promise<void> {
    const token = generateOpaqueToken();
    await this.tokens.replace({
      userId: user.id,
      purpose: 'email_verification',
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(
        this.clock.now().getTime() + EMAIL_VERIFICATION_TOKEN_LIFETIME_MS,
      ),
    });
    await this.mail.send('email-verification', user.email, {
      name: user.name,
      token,
    });
  }

  /**
   * Starts `resendLink` without waiting for it, so the response takes the
   * same time whether or not the email has an unverified account. Failures
   * are logged without the email or the error message.
   */
  requestResend(email: string): void {
    this.resendLink(email).catch((error: unknown) => {
      const name = error instanceof Error ? error.name : typeof error;
      this.logger.error(`Could not resend a verification link (${name})`);
    });
  }

  /** Emails a new link if `email` has an account that is still unverified. */
  async resendLink(email: string): Promise<void> {
    const user = await this.credentials.findByEmail(normalizeEmail(email));
    if (!user || user.emailVerifiedAt) {
      return;
    }
    await this.sendLink(user);
  }

  /**
   * Marks the email verified with a token from an emailed link and returns
   * the user, whom the caller signs in. Throws `invalidToken` for an unknown,
   * expired or used token, and when the email is already verified.
   */
  async verify(token: string): Promise<AuthUser> {
    if (!isWellFormedOpaqueToken(token)) {
      throw invalidToken();
    }

    const user = await this.credentials.verifyEmail({
      tokenHash: hashOpaqueToken(token),
      now: this.clock.now(),
    });
    if (!user) {
      throw invalidToken();
    }
    return toAuthUser(user);
  }
}
