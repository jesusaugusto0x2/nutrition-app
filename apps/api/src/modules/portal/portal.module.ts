import { Module } from '@nestjs/common';
import { PatientAccessRepository } from './patient-access.repository';
import { PatientAccessService } from './patient-access.service';

// TODO(portal): Read-only portal for patients and guardians: only the access
// check exists so far (see `@PortalAccess()`). Routes go under /api/portal,
// are read-only and must expose only shareable fields, through the exported
// services of the clinical modules. Pending the Portal epic.
@Module({
  providers: [PatientAccessRepository, PatientAccessService],
  exports: [PatientAccessService],
})
export class PortalModule {}
