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

export type PatientSex = z.infer<typeof patientSexSchema>;
export type Patient = z.infer<typeof patientSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
