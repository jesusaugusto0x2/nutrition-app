import { Module } from '@nestjs/common';
import { ClinicsRepository } from './clinics.repository';
import { ClinicsService } from './clinics.service';

@Module({
  providers: [ClinicsRepository, ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
