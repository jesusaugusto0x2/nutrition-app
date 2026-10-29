import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthUser } from '@nutri/schemas';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';

/** Email and password sign-in. Passport sessions are not used. */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  validate(email: string, password: string): Promise<AuthUser> {
    return this.authService.validateCredentials(email, password);
  }
}
