/**
 * Parsing of what users type, the counterpart of ./format.ts. Every helper
 * returns `null` for empty or unreadable input instead of throwing, so
 * forms can show their own message.
 */

/** Decimal typed with a comma or a dot: `66,9` and `66.9` are 66.9. */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$|^\d+\.$/.test(normalized)) {
    return null;
  }
  return Number(normalized);
}

/**
 * Height in meters. Values of 3 or more are read as centimeters, so `162`
 * and `1,62` both mean 1.62 m (spec: Campo con unidad).
 */
export function parseHeightInput(text: string): number | null {
  const value = parseDecimalInput(text);
  if (value === null) {
    return null;
  }
  return value >= 3 ? value / 100 : value;
}

/**
 * `dd/mm/aaaa` to a calendar date `YYYY-MM-DD`. Accepts one-digit day and
 * month (`4/10/2026`) and rejects dates that do not exist (`31/02/2026`).
 */
export function parseDateInput(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Lowercase without accents or surrounding spaces, for searching. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Whether `text` contains `query`, ignoring case and accents. */
export function matchesSearch(text: string, query: string): boolean {
  return normalizeForSearch(text).includes(normalizeForSearch(query));
}
