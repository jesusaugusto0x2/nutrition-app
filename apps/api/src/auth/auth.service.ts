import { Injectable, UnauthorizedException } from '@nestjs/common';
import { type AuthUser, normalizeEmail } from '@nutri/schemas';
import { CredentialsRepository } from './credentials/credentials.repository';
import { PasswordHasher } from './passwords/password-hasher';
import { toAuthUser } from './sessions/sessions.mapper';
import {
  type CreatedSession,
  SessionsService,
} from './sessions/sessions.service';

/**
 * The single sign-in failure: unknown email, wrong password and Google-only
 * accounts are indistinguishable, so the API does not reveal which emails
 * have an account.
 */
export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: SessionsService,
  ) {}

  /** The user for a correct email and password; otherwise `invalidCredentials`. */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const user = await this.credentials.findByEmail(normalizeEmail(email));

    if (!user?.passwordHash) {
      // Same cost as a real check, so timing does not reveal the account.
      await this.passwordHasher.verifyDummy(password);
      throw invalidCredentials();
    }

    if (!(await this.passwordHasher.verify(user.passwordHash, password))) {
      throw invalidCredentials();
    }

    if (this.passwordHasher.needsRehash(user.passwordHash)) {
      await this.credentials.updatePasswordHash(
        user.id,
        await this.passwordHasher.hash(password),
      );
    }
    return toAuthUser(user);
  }

  /**
   * Always creates a new session (prevents session fixation) and revokes the
   * one the browser presented, if any.
   */
  async startSession(
    userId: string,
    previousToken: string | null,
    userAgent: string | undefined,
  ): Promise<CreatedSession> {
    if (previousToken) {
      await this.sessions.revokeByToken(previousToken);
    }
    return this.sessions.create(userId, userAgent);
  }

  async signOut(token: string | null): Promise<void> {
    if (token) {
      await this.sessions.revokeByToken(token);
    }
  }
}
