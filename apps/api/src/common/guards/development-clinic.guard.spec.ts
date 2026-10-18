import {
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppConfig } from '../../config/app-config';
import { SEED_CLINIC_ID } from '../../database/seed/seed-ids';
import type { ClinicsService } from '../../modules/clinics/clinics.service';
import type { ClinicRequest } from '../http/clinic-request';
import { DevelopmentClinicGuard } from './development-clinic.guard';

function setup({
  nodeEnv = 'development' as AppConfig['NODE_ENV'],
  requiresClinic = true,
  clinicExists = true,
} = {}) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiresClinic);
  const clinicsService = {
    exists: vi.fn().mockResolvedValue(clinicExists),
  } as unknown as ClinicsService;
  const guard = new DevelopmentClinicGuard(
    reflector,
    { NODE_ENV: nodeEnv } as AppConfig,
    clinicsService,
  );
  const request: ClinicRequest = {} as ClinicRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { guard, context, request };
}

describe('DevelopmentClinicGuard (TEMPORARY)', () => {
  it('lets routes without @ClinicAccess() through untouched', async () => {
    const { guard, context, request } = setup({ requiresClinic: false });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.clinicId).toBeUndefined();
  });

  it('assigns the seed clinic in development', async () => {
    const { guard, context, request } = setup();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.clinicId).toBe(SEED_CLINIC_ID);
  });

  it.each(['production', 'test'] as const)(
    'rejects clinic routes when NODE_ENV=%s',
    async (nodeEnv) => {
      const { guard, context, request } = setup({ nodeEnv });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(request.clinicId).toBeUndefined();
    },
  );

  it('explains how to fix a missing seed clinic', async () => {
    const { guard, context } = setup({ clinicExists: false });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
