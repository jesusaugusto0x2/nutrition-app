import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock/clock';
import { PatientsModule } from '../patients/patients.module';
import { NotesController } from './notes.controller';
import { NotesRepository } from './notes.repository';
import { NotesService } from './notes.service';

@Module({
  imports: [PatientsModule],
  controllers: [NotesController],
  providers: [
    NotesRepository,
    NotesService,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [NotesService],
})
export class NotesModule {}
