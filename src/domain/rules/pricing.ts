import type { Tower, TowerDef } from '../model/types';

export const REFUND_RATE = 0.5;

export function upgradeCost(from: TowerDef, to: TowerDef): number {
  // Un mur transformé en tour : on ne paie que la différence.
  return from.family === 'wall' ? Math.max(0, to.cost - from.cost) : to.cost;
}

export function refundValue(t: Tower): number {
  return Math.floor(t.spent * REFUND_RATE);
}

/** Prix en éther du niveau `level` (1 = premier achat) d'une amélioration de la Porte. */
export function gateLevelCost(level: number): number {
  return 12 + 4 * (level - 1);
}

/** Le revenu gagné est le quart du prix payé. */
export function gateLevelIncome(level: number): number {
  return gateLevelCost(level) / 4;
}
