import type { Request } from 'express';

/** Request after the clinic context has been resolved by a guard. */
export interface ClinicRequest extends Request {
  clinicId?: string;
}
