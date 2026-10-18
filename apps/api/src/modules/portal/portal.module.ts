import { Module } from '@nestjs/common';

// TODO(portal): Read-only portal for patients and guardians (see the
// patient_access table). Out of scope until real auth exists. Routes go under
// /api/portal, are read-only and must expose only shareable fields, through
// the exported services of the clinical modules.
@Module({})
export class PortalModule {}
