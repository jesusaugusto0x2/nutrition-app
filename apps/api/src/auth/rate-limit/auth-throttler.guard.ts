import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

/**
 * `ThrottlerGuard` for authentication routes (see `RateLimit`). Not global:
 * clinic routes are not throttled.
 *
 * On a 429 it sets a single standard `Retry-After` header (the library
 * would name it `Retry-After-<throttler>`) and throws an `HttpException`
 * that `AllExceptionsFilter` turns into a `TOO_MANY_REQUESTS` error.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    context: ExecutionContext,
    { timeToBlockExpire }: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Retry-After', String(Math.max(1, timeToBlockExpire)));
    throw new HttpException(
      { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
