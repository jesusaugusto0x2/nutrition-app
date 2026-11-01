import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@nutri/schemas';
import type { PatientAccessService } from '../../modules/portal/patient-access.service';
import type { AuthenticatedRequest } from '../http/authenticated-request';
import { PortalAccessGuard } from './portal-access.guard';

const PATIENT_ID = '00000000-0000-4000-8000-000000000010';
const USER = { id: '00000000-0000-4000-8000-000000000003' } as AuthUser;

function setup({
  requiresPortal = true,
  user = USER as AuthUser | null,
  patientIds = [PATIENT_ID],
} = {}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiresPortal);
  const patientAccessService = {
    listPatientIds: vi.fn().mockResolvedValue(patientIds),
  };
  const guard = new PortalAccessGuard(
    reflector,
    patientAccessService as unknown as PatientAccessService,
  );
  const request = { user: user ?? undefined } as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { guard, context, request, patientAccessService };
}

describe('PortalAccessGuard', () => {
  it('lets routes without @PortalAccess() through untouched', async () => {
    const { guard, context, request, patientAccessService } = setup({
      requiresPortal: false,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(patientAccessService.listPatientIds).not.toHaveBeenCalled();
    expect(request.portalPatientIds).toBeUndefined();
  });

  it('exposes the patients the user can see', async () => {
    const { guard, context, request, patientAccessService } = setup();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(patientAccessService.listPatientIds).toHaveBeenCalledWith(USER.id);
    expect(request.portalPatientIds).toEqual([PATIENT_ID]);
  });

  it('rejects a user without patient access', async () => {
    const { guard, context, request } = setup({ patientIds: [] });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(request.portalPatientIds).toBeUndefined();
  });

  it('fails closed on a route that skipped the session check', async () => {
    const { guard, context, request } = setup({ user: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.portalPatientIds).toBeUndefined();
  });
});
