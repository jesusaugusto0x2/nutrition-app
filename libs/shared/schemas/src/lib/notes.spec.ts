import { createNoteSchema } from './notes.js';

describe('createNoteSchema', () => {
  it('accepts a body and trims it', () => {
    expect(createNoteSchema.parse({ body: '  Control en 30 días.  ' })).toEqual(
      { body: 'Control en 30 días.' },
    );
  });

  it('rejects a blank body', () => {
    expect(createNoteSchema.safeParse({ body: '   ' }).success).toBe(false);
  });

  it('rejects a body over the maximum', () => {
    expect(createNoteSchema.safeParse({ body: 'a'.repeat(2001) }).success).toBe(
      false,
    );
  });
});
