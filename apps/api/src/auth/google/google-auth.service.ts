import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '@nutri/schemas';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { TransactionRunner } from '../../database/transaction-runner';
import {
  AuthAccountsRepository,
  type ExternalIdentity,
} from '../accounts/auth-accounts.repository';
import { CredentialsRepository } from '../credentials/credentials.repository';
import {
  type GoogleAuthorizationRequest,
  type GoogleFlowChecks,
  type GoogleIdentity,
  GoogleOidcClient,
} from './google-oidc.client';

export type GoogleSignInFailure =
  'state-mismatch' | 'email-not-verified' | 'email-not-authoritative';

/** A sign-in we refused. `reason` is safe to log: it holds no user data. */
export class GoogleSignInError extends Error {
  constructor(readonly reason: GoogleSignInFailure) {
    super(`Google sign-in rejected: ${reason}`);
    this.name = 'GoogleSignInError';
  }
}

export interface GoogleSignIn {
  userId: string;
  /** The account was created now, so it has no clinic yet. */
  created: boolean;
}

/**
 * Whether Google speaks for this address: a Gmail account, or a Workspace
 * account (`hd`). Anyone can create a Google account on a third-party address,
 * and Google warns that `email_verified` then only says the address was
 * verified once: its owner may have changed since.
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */
export function isGoogleAuthoritative({
  email,
  hostedDomain,
}: Pick<GoogleIdentity, 'email' | 'hostedDomain'>): boolean {
  return normalizeEmail(email).endsWith('@gmail.com') || Boolean(hostedDomain);
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly oidc: GoogleOidcClient,
    private readonly accounts: AuthAccountsRepository,
    private readonly credentials: CredentialsRepository,
    private readonly transactions: TransactionRunner,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get enabled(): boolean {
    return this.oidc.configured;
  }

  start(): Promise<GoogleAuthorizationRequest> {
    return this.oidc.createAuthorizationRequest();
  }

  /**
   * Validates what Google sent back and resolves the account. `state` is
   * checked here too, before any call to Google, so a forged callback costs
   * nothing and the rule is visible without reading the library.
   */
  async finish(
    callbackQuery: string,
    checks: GoogleFlowChecks | null,
  ): Promise<GoogleSignIn> {
    const state = new URLSearchParams(callbackQuery).get('state');
    if (!checks || state !== checks.state) {
      throw new GoogleSignInError('state-mismatch');
    }

    const identity = await this.oidc.exchangeCode(callbackQuery, checks);
    if (!identity.emailVerified) {
      throw new GoogleSignInError('email-not-verified');
    }
    return this.resolveAccount(identity);
  }

  /**
   * In order: the linked account; a user with the same email, whom Google must
   * be authoritative for; a new user. One transaction, with the user's row
   * locked, so nothing changes between the decision and the link.
   */
  private resolveAccount(identity: GoogleIdentity): Promise<GoogleSignIn> {
    const external: ExternalIdentity = {
      provider: 'google',
      providerAccountId: identity.sub,
    };

    return this.transactions.run(async (tx) => {
      // By `sub` alone: the Google account may have a new email by now, and
      // that address may even belong to another user here.
      const linkedUserId = await this.accounts.findUserId(external, tx);
      if (linkedUserId) {
        return { userId: linkedUserId, created: false };
      }

      const email = normalizeEmail(identity.email);
      const now = this.clock.now();
      const existing = await this.credentials.findByEmailForUpdate(email, tx);

      if (!existing) {
        const { id } = await this.credentials.createVerified(
          {
            email,
            name: identity.name?.trim() || email,
            emailVerifiedAt: now,
          },
          tx,
        );
        await this.accounts.link(id, external, tx);
        return { userId: id, created: true };
      }

      // Refused rather than linked: this person can sign in another way, and
      // Google cannot vouch that they own the account behind this email.
      if (!isGoogleAuthoritative(identity)) {
        throw new GoogleSignInError('email-not-authoritative');
      }

      // A possible pre-registration: someone may have signed up with this
      // email, without owning it, to keep a password into the account.
      if (!existing.emailVerifiedAt) {
        await this.credentials.takeOverUnverified(existing.id, now, tx);
      }
      await this.accounts.link(existing.id, external, tx);
      return { userId: existing.id, created: false };
    });
  }
}
