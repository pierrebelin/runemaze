/** Acharnement : `step` de dégâts en plus par coup consécutif, plafonné à `max`. */
export function relentlessBonus(hits: number, step: number, max: number): number {
  return Math.min(hits * step, max);
}
