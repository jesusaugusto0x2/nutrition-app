import { es, type Messages } from './es';

// Single language for now. Adding one means creating e.g. `en.ts` typed as
// `Messages` and choosing between them here (or via a context if it must
// change at runtime).
export const locale = 'es';

export const t: Messages = es;
