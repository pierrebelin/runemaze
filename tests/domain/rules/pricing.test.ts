import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { gateLevelCost, gateLevelIncome, refundValue } from '../../../src/domain/rules/pricing';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('pricing', () => {
  it('[RM-01] rend la moitié de l\'or investi quand la tour est vendue avant la vague', () => {
    const w = newWorld();
    const r = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 });
    expect(r.ok).toBe(true);
    const t = w.towerById.get((r as { id: number }).id)!;
    expect(refundValue(t)).toBe(5);
  });

  it('[RM-01] rend toujours la moitié quand la vague est lancée', () => {
    const w = newWorld();
    const r = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 });
    const t = w.towerById.get((r as { id: number }).id)!;
    dispatch(w, { c: CommandType.CallWave });
    expect(refundValue(t)).toBe(5);
  });

  it('[RM-01] compte le mur et la différence payée quand un mur transformé est vendu', () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Upgrade, tower: r.id, def: 'cannon' });
    const t = w.towerById.get(r.id)!;
    expect(refundValue(t)).toBe(10);
  });

  it('[RM-01] arrondit à l\'or inférieur quand la moitié tombe entre deux pièces', () => {
    const w = newWorld();
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 });
    const t = w.towerById.get((r as { id: number }).id)!;
    expect(refundValue(t)).toBe(1);
  });

  it('[RM-08] coûte 12 éther au niveau 1, 20 au niveau 3, 48 au niveau 10', () => {
    expect(gateLevelCost(1)).toBe(12);
    expect(gateLevelCost(3)).toBe(20);
    expect(gateLevelCost(10)).toBe(48);
  });

  it('[RM-08] rapporte un quart du prix en revenu : +3 au niveau 1, +5 au niveau 3, +12 au niveau 10', () => {
    expect(gateLevelIncome(1)).toBe(3);
    expect(gateLevelIncome(3)).toBe(5);
    expect(gateLevelIncome(10)).toBe(12);
  });
});
