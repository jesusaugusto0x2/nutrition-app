import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../common/clock/clock';
import { SessionCookie } from './sessions/session-cookie';
import { SessionsRepository } from './sessions/sessions.repository';
import { SessionsService } from './sessions/sessions.service';

// TODO(auth): Sign-in endpoints, the session guard and clinic resolution from
// the user's membership land in the remaining tickets of the Authentication
// epic (#8). Until then the TEMPORARY DevelopmentClinicGuard (common/guards)
// stays in place; it is replaced by a guard that resolves the clinic for
// @ClinicAccess() routes, and portal access via patient_access is added.
@Module({
  providers: [
    SessionsRepository,
    SessionsService,
    SessionCookie,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [SessionsService, SessionCookie],
})
export class AuthModule {}
