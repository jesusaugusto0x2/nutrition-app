import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { signInSchema } from '@nutri/schemas';
import type { Request } from 'express';
import { ZodValidationException } from 'nestjs-zod';

/**
 * Runs the Passport local strategy on `POST /api/auth/sign-in`.
 *
 * Guards run before pipes, so the body is validated here: a malformed body
 * gets the usual 400 `VALIDATION_ERROR`, and a password over the maximum
 * length is rejected before it is ever hashed.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const result = signInSchema.safeParse(request.body);
    if (!result.success) {
      throw new ZodValidationException(result.error);
    }
    // The strategy reads the normalized email from here.
    request.body = result.data;
    return (await super.canActivate(context)) as boolean;
  }
}
