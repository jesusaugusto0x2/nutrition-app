/**
 * Rounds half away from zero to `decimals` places, so positive and negative
 * deltas of the same size round symmetrically (0.25 -> 0.3, -0.25 -> -0.3).
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.sign(value) * Math.round(Math.abs(value) * factor);
  // Avoid returning -0.
  return rounded / factor + 0;
}
