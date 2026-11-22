import { BadRequestException } from '@nestjs/common';

/**
 * The new password is in the bundled list of compromised or commonly used
 * passwords. The response names the reason; it never echoes the password.
 */
export function compromisedPassword(): BadRequestException {
  return new BadRequestException({
    code: 'COMPROMISED_PASSWORD',
    message: 'This password is too common or compromised; choose another one',
  });
}
