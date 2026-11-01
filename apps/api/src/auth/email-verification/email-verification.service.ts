import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { MailService } from '../../mail/mail.service';
import type { UserRecipientRow } from '../credentials/credentials.repository';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';
import { generateOpaqueToken, hashOpaqueToken } from '../tokens/opaque-token';

/** A verification link stops working this long after it is emailed. */
export const EMAIL_VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationService {
  constructor(
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
}
