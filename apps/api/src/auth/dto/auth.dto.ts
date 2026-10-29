import { authUserSchema } from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';

export class AuthUserDto extends createZodDto(authUserSchema) {}
