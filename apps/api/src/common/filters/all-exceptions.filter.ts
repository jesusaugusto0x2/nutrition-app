import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  type ApiError,
  type ApiErrorCode,
  type ApiErrorDetail,
  apiErrorCodeSchema,
} from '@nutri/schemas';
import type { Request } from 'express';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

interface ErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

/**
 * Turns every exception into the shared `ApiError` shape.
 *
 * Logging rule: never log request bodies, error messages from the database or
 * any value that could contain patient data. Only the route pattern, status
 * and error type are logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const request = host.switchToHttp().getRequest<Request>();
    const body = this.toErrorBody(exception);

    if (body.statusCode >= 500) {
      this.logServerError(request, body.statusCode, exception);
    }

    const response: ApiError = {
      ...body,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(
      host.switchToHttp().getResponse(),
      response,
      body.statusCode,
    );
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof ZodValidationException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: toDetails(exception.getZodError()),
      };
    }

    if (exception instanceof ZodSerializationException) {
      // The response did not match its schema: a server bug, not a client one.
      return internalError();
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode >= 500 && statusCode !== HttpStatus.SERVICE_UNAVAILABLE) {
        return internalError();
      }
      return {
        statusCode,
        code:
          explicitCode(exception) ?? CODE_BY_STATUS[statusCode] ?? 'HTTP_ERROR',
        message: exception.message,
      };
    }

    // Nest wraps invalid JSON in a BadRequestException, but body-parser's
    // size limit error arrives as a plain error identified by `type`.
    if (getStringProperty(exception, 'type') === 'entity.too.large') {
      return {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        code: 'HTTP_ERROR',
        message: 'Request body too large',
      };
    }

    return internalError();
  }

  private logServerError(
    request: Request,
    statusCode: number,
    exception: unknown,
  ): void {
    // Route pattern (e.g. /api/clinic/patients/:patientId), not the URL.
    const route: unknown = request.route?.path;
    const routeLabel = typeof route === 'string' ? route : 'unmatched route';
    const name = exception instanceof Error ? exception.name : typeof exception;
    const dbCode = getStringProperty(exception, 'code');
    // Drop the first stack line: it repeats the message, which may contain data.
    const stack =
      exception instanceof Error
        ? exception.stack?.split('\n').slice(1).join('\n')
        : undefined;

    this.logger.error(
      `${request.method} ${routeLabel} -> ${statusCode} ${name}${dbCode ? ` (code ${dbCode})` : ''}`,
      stack,
    );
  }
}

function internalError(): ErrorBody {
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

/**
 * A more specific code than the status implies, given as
 * `new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message })`.
 */
function explicitCode(exception: HttpException): ApiErrorCode | undefined {
  const result = apiErrorCodeSchema.safeParse(
    getStringProperty(exception.getResponse(), 'code'),
  );
  return result.success ? result.data : undefined;
}

function toDetails(error: unknown): ApiErrorDetail[] | undefined {
  if (!(error instanceof ZodError)) {
    return undefined;
  }
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (typeof value === 'object' && value !== null && key in value) {
    const property = (value as Record<string, unknown>)[key];
    return typeof property === 'string' ? property : undefined;
  }
  return undefined;
}
