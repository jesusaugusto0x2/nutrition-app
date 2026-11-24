import { z } from 'zod';
import {
  idSchema,
  isoDateSchema,
  notInFutureDateSchema,
  optionalTextSchema,
  timestampsSchema,
} from './common.js';

export const patientSexSchema = z.enum(['female', 'male']);

const nameSchema = z.string().trim().min(1).max(100);

/** Patient as returned by the clinic API. */
export const patientSchema = z
  .object({
    id: idSchema,
    firstName: z.string(),
    lastName: z.string(),
    birthDate: isoDateSchema,
    sex: patientSexSchema,
    phone: z.string().nullable(),
    address: z.string().nullable(),
  })
  .extend(timestampsSchema.shape);

export const createPatientSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  birthDate: notInFutureDateSchema,
  sex: patientSexSchema,
  phone: optionalTextSchema(30),
  address: optionalTextSchema(300),
});

export const updatePatientSchema = createPatientSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'At least one field must be provided',
  });

/** Sort orders of the clinic patient list. */
export const patientListSortSchema = z.enum(['recent', 'name']);

/** Query parameters of `GET /api/clinic/patients`. */
export const patientListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  sort: patientListSortSchema.default('recent'),
});

/**
 * Patient list item: the patient plus the weight summary of its latest
 * consultations. The trend is the weight difference against the previous
 * consultation; it is null with fewer than two consultations.
 */
export const patientListItemSchema = patientSchema.extend({
  lastConsultation: z
    .object({ date: isoDateSchema, weightKg: z.number() })
    .nullable(),
  currentWeight: z.number().nullable(),
  trendWeightKg: z.number().nullable(),
});

export type PatientSex = z.infer<typeof patientSexSchema>;
export type Patient = z.infer<typeof patientSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListSort = z.infer<typeof patientListSortSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
export type PatientListItem = z.infer<typeof patientListItemSchema>;
