import { SetMetadata } from '@nestjs/common';

export const CLINIC_ACCESS_KEY = 'clinicAccess';

/**
 * Marks a controller or handler as clinic-scoped: a guard must resolve the
 * caller's clinic before it runs, and `@CurrentClinic()` becomes available.
 * Every /api/clinic/* controller must use it.
 */
export const ClinicAccess = () => SetMetadata(CLINIC_ACCESS_KEY, true);
