/** Montée en puissance : 1 % de vitesse d'attaque par seconde, plafonné à `max`. */
export function rampBonus(seconds: number, max: number): number {
  return Math.min(max, 0.01 * seconds);
}

/** Recharge effective : la base divisée par (1 + bonus de vitesse d'attaque). */
export function attackCooldown(base: number, speedBonus: number): number {
  return base / (1 + speedBonus);
}
