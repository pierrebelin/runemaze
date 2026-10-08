import type { Grid } from '../model/Grid';
import type { Tower } from '../model/types';

/** Bonus de portée d'un cristal : jamais cumulé, un seul cristal sous l'emprise suffit. */
export function crystalBonus(grid: Grid, cells: number[], bonus: number): number {
  return cells.some(i => grid.kind[i] === 'crystal') ? bonus : 0;
}

/** Portée d'attaque du catalogue, majorée du bonus de cristal ; 0 pour une tour sans attaque. */
export function towerRange(t: Pick<Tower, 'def' | 'rangeBonus'>): number {
  return (t.def.attack?.range ?? 0) * (1 + t.rangeBonus);
}
