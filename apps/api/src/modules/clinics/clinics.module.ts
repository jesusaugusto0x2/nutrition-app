import { Module } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { MembershipsRepository } from './memberships.repository';

@Module({
  providers: [ClinicsService, MembershipsRepository],
  exports: [ClinicsService],
})
export class ClinicsModule {}
