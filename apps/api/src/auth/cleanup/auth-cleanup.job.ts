import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { SessionsService } from '../sessions/sessions.service';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';

/** Name in Nest's `SchedulerRegistry`. */
export const AUTH_CLEANUP_JOB = 'auth-cleanup';

/**
 * Physically deletes sessions and one-time tokens that can no longer be used.
 * Idempotent, so a missed run is caught up by the next one and a duplicate run
 * deletes nothing. See "Scheduled jobs" in docs/deployment.md.
 */
@Injectable()
export class AuthCleanupJob {
  private readonly logger = new Logger(AuthCleanupJob.name);

  constructor(
    private readonly sessions: SessionsService,
    private readonly tokens: AuthTokensRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Catches every failure: `@nestjs/schedule` would log the whole error, and
   * a query error carries its SQL and parameters.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: AUTH_CLEANUP_JOB,
    timeZone: 'UTC',
  })
  async run(): Promise<void> {
    try {
      const sessions = await this.sessions.deleteInactive();
      const tokens = await this.tokens.deleteExpiredOrUsed(this.clock.now());
      this.logger.log(
        `Deleted ${sessions} sessions and ${tokens} one-time tokens`,
      );
    } catch (error) {
      const name = error instanceof Error ? error.name : typeof error;
      this.logger.error(`Could not clean up auth data (${name})`);
    }
  }
}
