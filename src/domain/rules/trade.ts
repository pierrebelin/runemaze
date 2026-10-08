import type { Tower } from '../model/types';

export function tradeIncome(towers: Pick<Tower, 'def'>[]): number {
  return towers.reduce((sum, t) => sum + (t.def.trade ?? 0), 0);
}
