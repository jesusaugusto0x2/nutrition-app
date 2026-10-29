import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { normalizeEmail } from '@nutri/schemas';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { MailService } from '../../mail/mail.service';
import { CredentialsRepository } from '../credentials/credentials.repository';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  isWellFormedOpaqueToken,
} from '../tokens/opaque-token';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';
import { PasswordHasher } from './password-hasher';

/** A reset link stops working this long after it is emailed. */
export const PASSWORD_RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

/**
 * The single reset failure: unknown, expired and already used tokens are
 * indistinguishable.
 */
export function invalidToken(): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_TOKEN',
    message: 'The link is invalid or has expired',
  });
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokensRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly mail: MailService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Starts `sendResetLink` without waiting for it, so the response takes the
   * same time whether or not the email has an account. Failures are logged
   * without the email or the error message.
   */
  requestReset(email: string): void {
    this.sendResetLink(email).catch((error: unknown) => {
      const name = error instanceof Error ? error.name : typeof error;
      this.logger.error(`Could not process a password reset request (${name})`);
    });
  }

  /**
   * Emails a reset link if `email` has an account (also Google-only ones,
   * which can set a password this way). Replaces any earlier link.
   */
  async sendResetLink(email: string): Promise<void> {
    const user = await this.credentials.findByEmail(normalizeEmail(email));
    if (!user) {
      return;
    }

    const token = generateOpaqueToken();
    await this.tokens.replace({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(
        this.clock.now().getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
      ),
    });
    await this.mail.send('password-reset', user.email, {
      name: user.name,
      token,
    });
  }

  /**
   * Sets a new password with a token from a reset link, signs the user out
   * everywhere and notifies them. Does not sign them in. Throws
   * `invalidToken` for an unknown, expired or used token.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    if (!isWellFormedOpaqueToken(token)) {
      throw invalidToken();
    }

    const user = await this.credentials.resetPassword({
      tokenHash: hashOpaqueToken(token),
      passwordHash: await this.passwordHasher.hash(password),
      now: this.clock.now(),
    });
    if (!user) {
      throw invalidToken();
    }

    try {
      await this.mail.send('password-changed', user.email, { name: user.name });
    } catch (error) {
      // The password already changed; a missing notice must not undo it.
      const name = error instanceof Error ? error.name : typeof error;
      this.logger.error(`Could not send the password changed notice (${name})`);
    }
  }
}
