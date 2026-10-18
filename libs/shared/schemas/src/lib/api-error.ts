import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'HTTP_ERROR',
]);

export const apiErrorDetailSchema = z.object({
  /** Dot-separated path of the invalid field, e.g. `weightKg`. */
  path: z.string(),
  message: z.string(),
  code: z.string(),
});

/** Body of every error response returned by the API. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.array(apiErrorDetailSchema).optional(),
  path: z.string(),
  timestamp: z.iso.datetime(),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
