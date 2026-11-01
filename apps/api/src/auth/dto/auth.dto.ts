import {
  authMeSchema,
  authUserSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
} from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';

export class AuthUserDto extends createZodDto(authUserSchema) {}

export class AuthMeDto extends createZodDto(authMeSchema) {}

export class SignUpDto extends createZodDto(signUpSchema) {}

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}

export class ResendVerificationDto extends createZodDto(
  resendVerificationSchema,
) {}
