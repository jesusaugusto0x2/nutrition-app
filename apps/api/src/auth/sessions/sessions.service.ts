import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '@nutri/schemas';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { USER_AGENT_MAX_LENGTH } from '../../database/schema';
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedSessionToken,
} from './session-token';
import { toAuthUser } from './sessions.mapper';
import { SessionsRepository } from './sessions.repository';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A session ends this long after sign-in, however active it is. */
export const SESSION_ABSOLUTE_LIFETIME_MS = 30 * DAY_MS;
/** A session ends when unused for this long. */
export const SESSION_IDLE_TIMEOUT_MS = 7 * DAY_MS;
/** `last_used_at` is written at most this often, not on every request. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * MINUTE_MS;

export interface CreatedSession {
  /** Raw token for the cookie. Returned only here, never stored. */
  token: string;
  expiresAt: Date;
}

export interface ValidSession {
  /** Session id, for `revoke` (e.g. sign-out). */
  id: string;
  user: AuthUser;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly repository: SessionsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(
    userId: string,
    userAgent: string | null | undefined,
  ): Promise<CreatedSession> {
    const now = this.clock.now();
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_LIFETIME_MS);

    await this.repository.create({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastUsedAt: now,
      userAgent: truncateUserAgent(userAgent),
    });
    return { token, expiresAt };
  }

  /**
   * The session's user, or `null` for an unknown, revoked, expired or idle
   * token. An expired or idle session is deleted.
   */
  async validate(token: string): Promise<ValidSession | null> {
    if (!isWellFormedSessionToken(token)) {
      return null;
    }

    const now = this.clock.now();
    const tokenHash = hashSessionToken(token);
    const session = await this.repository.findActiveByTokenHash(tokenHash, {
      now,
      idleSince: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS),
    });

    if (!session) {
      // No-op for unknown tokens; removes the row of an expired or idle one.
      await this.repository.deleteByTokenHash(tokenHash);
      return null;
    }

    if (
      now.getTime() - session.lastUsedAt.getTime() >=
      SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.repository.touch(session.id, now);
    }
    return { id: session.id, user: toAuthUser(session.user) };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.repository.deleteById(sessionId);
  }

  /** Revokes the session a raw token belongs to, if any (e.g. sign-out). */
  async revokeByToken(token: string): Promise<void> {
    if (!isWellFormedSessionToken(token)) {
      return;
    }
    await this.repository.deleteByTokenHash(hashSessionToken(token));
  }

  /** Signs the user out everywhere (e.g. after a password reset). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.repository.deleteAllForUser(userId);
  }
}

function truncateUserAgent(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) {
    return null;
  }
  // By code point, as varchar counts characters: never split a surrogate pair.
  return Array.from(userAgent).slice(0, USER_AGENT_MAX_LENGTH).join('');
}
