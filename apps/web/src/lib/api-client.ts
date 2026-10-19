import { type ApiError, apiErrorSchema } from '@nutri/schemas';
import type { z } from 'zod';

const API_PREFIX = '/api';

/** Thrown for any non-2xx response. `body` follows the shared ApiError shape. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiClientError';
  }
}

/**
 * Typed HTTP client for the API. Every response is validated against a
 * schema from @nutri/schemas, so the UI only sees data matching the shared
 * contract.
 */
export const apiClient = {
  get<TSchema extends z.ZodType>(path: string, schema: TSchema) {
    return request(path, schema, { method: 'GET' });
  },

  post<TSchema extends z.ZodType>(
    path: string,
    body: unknown,
    schema: TSchema,
  ) {
    return request(path, schema, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch<TSchema extends z.ZodType>(
    path: string,
    body: unknown,
    schema: TSchema,
  ) {
    return request(path, schema, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};

async function request<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  init: RequestInit,
): Promise<z.output<TSchema>> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await readJson(response));
    throw new ApiClientError(
      response.status,
      parsed.success ? parsed.data : null,
    );
  }

  return schema.parse(await readJson(response));
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
