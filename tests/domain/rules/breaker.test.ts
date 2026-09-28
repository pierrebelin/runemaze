import { describe, expect, it } from 'vitest';
import { nearestTowers } from '../../../src/domain/rules/breaker';
import { dispatch } from '../../../src/application/dispatch';
import { newWorld } from '../../support/helpers';
import type { Tower } from '../../../src/domain/model/types';
import { CommandType } from '../../../src/domain/model/types';

function build(world: ReturnType<typeof newWorld>, def: string, x: number, y: number): Tower {
  const r = dispatch(world, { c: CommandType.Build, def, x, y });
  expect(r.ok).toBe(true);
  return world.towers.find((t) => t.id === (r as { ok: true; id: number }).id)!;
}

describe('nearestTowers', () => {
  it('[RM-05] retient le mur à 1 case plutôt que le Canon à 2 cases', () => {
    const w = newWorld();
    const wall = build(w, 'wall', 5, 5);
    build(w, 'cannon', 9, 4);

    const result = nearestTowers(w.towers, 7.5, 5.5, 3);

    expect(result).toEqual([wall]);
  });

  it('[RM-05] retient toutes les tours à égalité de distance', () => {
    const w = newWorld();
    const wallA = build(w, 'wall', 5, 5);
    const wallB = build(w, 'wall', 8, 4);

    const result = nearestTowers(w.towers, 7.5, 5.5, 3);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([wallA, wallB]));
  });

  it('[RM-05] ne retient aucune tour au-delà de la portée', () => {
    const wOut = newWorld();
    build(wOut, 'wall', 11, 5);
    expect(nearestTowers(wOut.towers, 7.5, 5.5, 3)).toEqual([]);

    const wIn = newWorld();
    const wallAtLimit = build(wIn, 'wall', 10, 5);
    expect(nearestTowers(wIn.towers, 7.5, 5.5, 3)).toEqual([wallAtLimit]);
  });
});
