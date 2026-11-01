import { BadRequestException } from '@nestjs/common';

/**
 * The single failure for a token from an emailed link: unknown, expired and
 * already used tokens are indistinguishable.
 */
export function invalidToken(): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_TOKEN',
    message: 'The link is invalid or has expired',
  });
}
