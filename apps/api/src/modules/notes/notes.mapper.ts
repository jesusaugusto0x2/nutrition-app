import type { Note } from '@nutri/schemas';
import type { NoteRow } from './notes.repository';

/** Maps a database row to the API shape. Internal columns are not exposed. */
export function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    patientId: row.patientId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
