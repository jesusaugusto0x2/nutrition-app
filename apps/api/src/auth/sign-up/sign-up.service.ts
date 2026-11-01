import { Injectable, Logger } from '@nestjs/common';
import { normalizeEmail, type SignUp } from '@nutri/schemas';
import { TransactionRunner } from '../../database/transaction-runner';
import { MailService } from '../../mail/mail.service';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { CredentialsRepository } from '../credentials/credentials.repository';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { PasswordHasher } from '../passwords/password-hasher';

@Injectable()
export class SignUpService {
  private readonly logger = new Logger(SignUpService.name);

  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly clinics: ClinicsService,
    private readonly emailVerification: EmailVerificationService,
    private readonly mail: MailService,
    private readonly transactions: TransactionRunner,
  ) {}

  /**
   * Starts `signUp` without waiting for it, so the response takes the same
   * time whether or not the email has an account. Failures are logged
   * without the request data or the error message.
   */
  requestSignUp(input: SignUp): void {
    this.signUp(input).catch((error: unknown) => {
      const name = error instanceof Error ? error.name : typeof error;
      this.logger.error(`Could not process a sign-up request (${name})`);
    });
  }

  /**
   * Creates the unverified user, their clinic and an `owner` membership in
   * one transaction, then emails a verification link. When the email already
   * has an account, nothing changes and its owner gets a notice instead.
   * Never signs the user in: that happens when they verify the email.
   */
  async signUp({ name, email, password, clinicName }: SignUp): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await this.passwordHasher.hash(password);

    // Emails go out after the commit: a transaction must not stay open during
    // an SMTP call, and a rollback must not leave a link to nothing.
    const user = await this.transactions.run(async (tx) => {
      const created = await this.credentials.createUnverified(
        { email: normalizedEmail, name, passwordHash },
        tx,
      );
      if (created) {
        await this.clinics.createWithOwner(
          { name: clinicName, ownerId: created.id },
          tx,
        );
      }
      return created;
    });

    if (user) {
      await this.emailVerification.sendLink(user);
    } else {
      await this.notifyExistingAccount(normalizedEmail);
    }
  }

  /** Uses the stored name: the submitted one is whatever the caller typed. */
  private async notifyExistingAccount(email: string): Promise<void> {
    const existing = await this.credentials.findByEmail(email);
    if (existing) {
      await this.mail.send('sign-up-attempt', existing.email, {
        name: existing.name,
      });
    }
  }
}
