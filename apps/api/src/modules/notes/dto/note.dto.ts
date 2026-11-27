import { createNoteSchema, idSchema, noteSchema } from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class NoteDto extends createZodDto(noteSchema) {}

export class CreateNoteDto extends createZodDto(createNoteSchema) {}

export class NotesParamsDto extends createZodDto(
  z.object({ patientId: idSchema }),
) {}

export class NoteParamsDto extends createZodDto(
  z.object({ patientId: idSchema, noteId: idSchema }),
) {}
