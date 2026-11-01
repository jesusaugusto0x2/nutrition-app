import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@nutri/schemas';
import type { AuthenticatedRequest } from '../../common/http/authenticated-request';
import type { SessionCookie } from './session-cookie';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionsService, ValidSession } from './sessions.service';

const USER: AuthUser = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'owner@example.com',
  name: 'Owner',
  emailVerified: true,
};

function setup({
  isPublic = false,
  token = 'raw-token' as string | null,
  session = { id: 'session-id', user: USER } as ValidSession | null,
} = {}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  const sessionsService = {
    validate: vi.fn().mockResolvedValue(session),
  };
  const sessionCookie = { read: vi.fn().mockReturnValue(token) };
  const guard = new SessionAuthGuard(
    reflector,
    sessionsService as unknown as SessionsService,
    sessionCookie as unknown as SessionCookie,
  );
  const request = {} as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { guard, context, request, sessionsService };
}

describe('SessionAuthGuard', () => {
  it('lets @Public() routes through without looking at the cookie', async () => {
    const { guard, context, request, sessionsService } = setup({
      isPublic: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionsService.validate).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('attaches the user of a valid session', async () => {
    const { guard, context, request, sessionsService } = setup();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionsService.validate).toHaveBeenCalledWith('raw-token');
    expect(request.user).toEqual(USER);
  });

  it('rejects a request without a cookie', async () => {
    const { guard, context, request, sessionsService } = setup({
      token: null,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessionsService.validate).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('rejects a token without a valid session', async () => {
    const { guard, context, request } = setup({ session: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });
});
