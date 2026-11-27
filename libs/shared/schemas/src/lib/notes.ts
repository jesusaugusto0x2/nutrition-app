import { z } from 'zod';
import { idSchema, timestampsSchema } from './common.js';

export const NOTE_BODY_MAX_LENGTH = 2000;

/**
 * Internal patient note as returned by the clinic API. Notes are
 * nutritionist-only: they are never exposed to the portal.
 */
export const noteSchema = z
  .object({
    id: idSchema,
    patientId: idSchema,
    body: z.string(),
  })
  .extend(timestampsSchema.shape);

export const createNoteSchema = z.object({
  body: z.string().trim().min(1).max(NOTE_BODY_MAX_LENGTH),
});

export type Note = z.infer<typeof noteSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
