import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type AuthMe, type AuthUser, normalizeEmail } from '@nutri/schemas';
import { ClinicsService } from '../modules/clinics/clinics.service';
import { PatientAccessService } from '../modules/portal/patient-access.service';
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

/**
 * Only thrown after a correct password, so it reveals nothing to someone who
 * does not already hold the credentials.
 */
export function emailNotVerified(): ForbiddenException {
  return new ForbiddenException({
    code: 'EMAIL_NOT_VERIFIED',
    message: 'The email is not verified',
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly clinics: ClinicsService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  /**
   * The user for a correct email and password; otherwise `invalidCredentials`,
   * or `emailNotVerified` when only the verification is missing.
   */
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

    if (!user.emailVerifiedAt) {
      throw emailNotVerified();
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

  /** The signed-in user with their own clinics and portal patients. */
  async getMe(user: AuthUser): Promise<AuthMe> {
    const [memberships, patientAccess] = await Promise.all([
      this.clinics.listMembershipsForUser(user.id),
      this.patientAccess.listForUser(user.id),
    ]);
    return { user, memberships, patientAccess };
  }
}
