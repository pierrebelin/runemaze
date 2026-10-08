import { describe, expect, it } from 'vitest';
import { crystalBonus, towerRange } from '../../../src/domain/rules/crystal';
import { TOWERS } from '../../../src/domain/catalog/towers';
import { Grid } from '../../../src/domain/model/Grid';

const BONUS = 0.2;

// Cristaux en (1,1) et (2,1) ; le reste est constructible.
const grid = new Grid({ id: 'test', name: 'test', width: 5, height: 4, rows: ['.....', '.++..', '.....', '.....'] });

describe('crystal', () => {
  it('[RM-05] vaut 20 % quand l’emprise recouvre un cristal, 0 sinon', () => {
    expect(crystalBonus(grid, grid.footprint(0, 0), BONUS)).toBe(BONUS);
    expect(crystalBonus(grid, grid.footprint(3, 2), BONUS)).toBe(0);
  });

  it('[RM-05] vaut encore 20 % quand l’emprise recouvre deux cristaux', () => {
    expect(crystalBonus(grid, grid.footprint(1, 0), BONUS)).toBe(BONUS);
  });

  it('[RM-05] multiplie la portée du catalogue par 1,2 quand la tour a le bonus de cristal', () => {
    const base = TOWERS.archer.attack!.range;

    expect(towerRange({ def: TOWERS.archer, rangeBonus: BONUS })).toBeCloseTo(base * 1.2);
    expect(towerRange({ def: TOWERS.archer, rangeBonus: 0 })).toBe(base);
  });
});
