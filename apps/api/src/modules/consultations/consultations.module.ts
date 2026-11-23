import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock/clock';
import { PatientsModule } from '../patients/patients.module';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsRepository } from './consultations.repository';
import { ConsultationsService } from './consultations.service';

@Module({
  imports: [PatientsModule],
  controllers: [ConsultationsController],
  providers: [
    ConsultationsRepository,
    ConsultationsService,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
