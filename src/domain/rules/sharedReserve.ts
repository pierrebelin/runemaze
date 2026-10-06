/** Réserve de vies commune au départ d'une partie coopérative. */
export function sharedReserve(soloLives: number): number {
  return 2 * soloLives;
}
