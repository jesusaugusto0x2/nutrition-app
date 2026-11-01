import { Module } from '@nestjs/common';
import { ClinicsRepository } from './clinics.repository';
import { ClinicsService } from './clinics.service';
import { MembershipsRepository } from './memberships.repository';

@Module({
  providers: [ClinicsRepository, ClinicsService, MembershipsRepository],
  exports: [ClinicsService],
})
export class ClinicsModule {}
