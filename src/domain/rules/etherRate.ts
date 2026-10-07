/** Éther annoncé par minute pour `gleaners` glaneurs produisant chacun 1 éther toutes les `period` secondes. */
export function etherPerMinute(gleaners: number, period: number): number {
  return gleaners * 60 / period;
}
