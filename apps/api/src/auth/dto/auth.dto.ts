import {
  authMeSchema,
  authUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';

export class AuthUserDto extends createZodDto(authUserSchema) {}

export class AuthMeDto extends createZodDto(authMeSchema) {}

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
