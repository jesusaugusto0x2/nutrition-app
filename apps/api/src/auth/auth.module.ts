import { Module } from '@nestjs/common';

// TODO(auth): Real authentication (users, sessions or tokens) and clinic
// resolution from the user's membership. When it lands, replace the
// TEMPORARY DevelopmentClinicGuard (common/guards) with a guard that resolves
// the clinic for @ClinicAccess() routes, and add portal access via
// patient_access.
@Module({})
export class AuthModule {}
