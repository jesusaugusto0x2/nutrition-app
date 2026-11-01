import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@nutri/schemas';
import type { ClinicsService } from '../../modules/clinics/clinics.service';
import type { AuthenticatedRequest } from '../http/authenticated-request';
import { ClinicAccessGuard } from './clinic-access.guard';

const CLINIC_ID = '00000000-0000-4000-8000-000000000001';
const USER = { id: '00000000-0000-4000-8000-000000000002' } as AuthUser;

function setup({
  requiresClinic = true,
  user = USER as AuthUser | null,
  clinicId = CLINIC_ID as string | null,
} = {}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiresClinic);
  const clinicsService = {
    findClinicIdForUser: vi.fn().mockResolvedValue(clinicId),
  };
  const guard = new ClinicAccessGuard(
    reflector,
    clinicsService as unknown as ClinicsService,
  );
  const request = { user: user ?? undefined } as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { guard, context, request, clinicsService };
}

describe('ClinicAccessGuard', () => {
  it('lets routes without @ClinicAccess() through untouched', async () => {
    const { guard, context, request, clinicsService } = setup({
      requiresClinic: false,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(clinicsService.findClinicIdForUser).not.toHaveBeenCalled();
    expect(request.clinicId).toBeUndefined();
  });

  it("sets the clinic from the user's membership", async () => {
    const { guard, context, request, clinicsService } = setup();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(clinicsService.findClinicIdForUser).toHaveBeenCalledWith(USER.id);
    expect(request.clinicId).toBe(CLINIC_ID);
  });

  it('rejects a user without a membership', async () => {
    const { guard, context, request } = setup({ clinicId: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(request.clinicId).toBeUndefined();
  });

  it('fails closed on a route that skipped the session check', async () => {
    const { guard, context, request } = setup({ user: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.clinicId).toBeUndefined();
  });
});
