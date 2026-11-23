import { z } from 'zod';
import {
  idSchema,
  isoDateSchema,
  notInFutureDateSchema,
  optionalTextSchema,
  timestampsSchema,
} from './common.js';

// Metric units only: kilograms, meters and centimeters.
const weightKgSchema = z.number().positive().max(500);
const heightMSchema = z.number().min(0.3).max(2.6);
const centimetersSchema = z.number().positive().max(300);

/** Consultation (visit) as returned by the clinic API. */
export const consultationSchema = z
  .object({
    id: idSchema,
    patientId: idSchema,
    date: isoDateSchema,
    weightKg: z.number(),
    heightM: z.number().nullable(),
    armCm: z.number().nullable(),
    waistCm: z.number().nullable(),
    legCm: z.number().nullable(),
    hipCm: z.number().nullable(),
    notes: z.string().nullable(),
  })
  .extend(timestampsSchema.shape);

export const createConsultationSchema = z.object({
  date: notInFutureDateSchema,
  weightKg: weightKgSchema,
  heightM: heightMSchema.nullable().optional(),
  armCm: centimetersSchema.nullable().optional(),
  waistCm: centimetersSchema.nullable().optional(),
  legCm: centimetersSchema.nullable().optional(),
  hipCm: centimetersSchema.nullable().optional(),
  notes: optionalTextSchema(2000),
});

/**
 * Editing replaces the same editable fields as create with the same
 * validations: weight stays required, so a corrected consultation always
 * keeps at least one measurement.
 */
export const updateConsultationSchema = createConsultationSchema;

export type Consultation = z.infer<typeof consultationSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
