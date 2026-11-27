import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateNoteInput, Note } from '@nutri/schemas';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { PatientsService } from '../patients/patients.service';
import { toNote } from './notes.mapper';
import { NotesRepository } from './notes.repository';

@Injectable()
export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    // Cross-module access goes through the exported service, never through
    // PatientsRepository.
    private readonly patientsService: PatientsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listByPatient(clinicId: string, patientId: string): Promise<Note[]> {
    await this.patientsService.assertExists(clinicId, patientId);
    const rows = await this.notesRepository.findByPatient(clinicId, patientId);
    return rows.map(toNote);
  }

  async create(
    clinicId: string,
    patientId: string,
    createdBy: string,
    input: CreateNoteInput,
  ): Promise<Note> {
    await this.patientsService.assertExists(clinicId, patientId);
    const row = await this.notesRepository.create(
      clinicId,
      patientId,
      createdBy,
      input,
    );
    return toNote(row);
  }

  async softDelete(
    clinicId: string,
    patientId: string,
    noteId: string,
  ): Promise<void> {
    await this.patientsService.assertExists(clinicId, patientId);
    const row = await this.notesRepository.softDelete(
      clinicId,
      patientId,
      noteId,
      this.clock.now(),
    );
    if (!row) {
      throw noteNotFound();
    }
  }
}

// Same response whether the note does not exist, is soft-deleted or belongs
// to another clinic, so ids from other clinics cannot be probed.
function noteNotFound(): NotFoundException {
  return new NotFoundException('Note not found');
}
