import { describe, expect, it } from 'vitest';
import { TOWERS } from '../../../src/domain/catalog/towers';
import { TOWER_ART, decorSeed } from '../../../src/infrastructure/render/sprites';
import { CREEPS } from '../../../src/domain/catalog/creeps';
import { CREEP_STYLE } from '../../../src/infrastructure/render/palette';
import { drawMap } from '../../../src/domain/rules/mapDraw';
import { MAP_RECIPE } from '../../../src/domain/catalog/map';

describe('dessins des tours', () => {
  it('donne à chaque tour du catalogue un dessin qui lui est propre', () => {
    for (const id of Object.keys(TOWERS)) expect(TOWER_ART[id], id).toBeTypeOf('function');
    expect(new Set(Object.values(TOWER_ART)).size).toBe(Object.keys(TOWER_ART).length);
  });
});

describe('styles des créatures', () => {
  it('donne un style à chaque créature du catalogue', () => {
    for (const id of Object.keys(CREEPS)) expect(CREEP_STYLE[id], id).toBeDefined();
  });
});

describe('decorSeed', () => {
  it('[RM-10] donne la même graine de décor quand la carte est la même', () => {
    const a = drawMap(7, 'earth', MAP_RECIPE);
    const b = drawMap(7, 'earth', MAP_RECIPE);

    expect(decorSeed(a)).toBe(decorSeed(b));
  });

  it('[RM-10] donne une graine de décor différente quand la disposition change', () => {
    const a = drawMap(1, 'earth', MAP_RECIPE);
    const b = drawMap(2, 'earth', MAP_RECIPE);

    expect(a.rows).not.toEqual(b.rows);
    expect(decorSeed(a)).not.toBe(decorSeed(b));
  });
});
