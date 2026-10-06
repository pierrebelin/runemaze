import { describe, expect, it } from 'vitest';
import { auraBonus } from '../../../src/domain/rules/aura';
import { TOWERS } from '../../../src/domain/catalog/towers';
import type { AuraKind, Tower } from '../../../src/domain/model/types';

function tower(id: number, cx: number, cy: number, aura?: { kind: AuraKind; pct: number; radius: number }): Tower {
  return {
    id, def: { ...TOWERS.wall, aura }, x: cx - 0.5, y: cy - 0.5, cx, cy,
    cooldown: 0, targetMode: 'first', spent: 0, kills: 0, damage: 0, aim: 0, ramp: 0, fate: 'standing',
  };
}

describe('aura', () => {
  it('[RM-06] donne à une tour le bonus de dégâts d\'une aura à portée', () => {
    const t = tower(1, 5, 5);
    const src = tower(2, 7, 5, { kind: 'damage', pct: 0.2, radius: 3 });

    expect(auraBonus(t, [t, src])).toEqual({ damage: 0.2, attackSpeed: 0 });
  });

  it('[RM-06] ne garde que la plus forte de deux auras du même type', () => {
    const t = tower(1, 5, 5);
    const weak = tower(2, 7, 5, { kind: 'attackSpeed', pct: 0.1, radius: 3 });
    const strong = tower(3, 5, 7, { kind: 'attackSpeed', pct: 0.25, radius: 3 });

    expect(auraBonus(t, [t, weak, strong])).toEqual({ damage: 0, attackSpeed: 0.25 });
  });

  it('[RM-06] cumule une aura de dégâts et une aura de vitesse d\'attaque', () => {
    const t = tower(1, 5, 5);
    const dmg = tower(2, 7, 5, { kind: 'damage', pct: 0.2, radius: 3 });
    const spd = tower(3, 5, 7, { kind: 'attackSpeed', pct: 0.1, radius: 3 });

    expect(auraBonus(t, [t, dmg, spd])).toEqual({ damage: 0.2, attackSpeed: 0.1 });
  });

  it('[RM-06] ne donne pas à une tour sa propre aura', () => {
    const own = tower(1, 5, 5, { kind: 'damage', pct: 0.2, radius: 3 });
    const other = tower(2, 6, 5);
    const witness = tower(3, 5, 6, { kind: 'damage', pct: 0.2, radius: 3 });

    expect(auraBonus(own, [own, other])).toEqual({ damage: 0, attackSpeed: 0 });
    expect(auraBonus(other, [own, other]).damage).toBe(0.2);
    expect(auraBonus(own, [own, witness]).damage).toBe(0.2);
  });

  it('[RM-06] ignore une aura dont la tour est à plus de 3 cases', () => {
    const t = tower(1, 5, 5);
    const near = tower(2, 8, 5, { kind: 'damage', pct: 0.2, radius: 3 });
    const far = tower(3, 8.5, 5, { kind: 'damage', pct: 0.2, radius: 3 });

    expect(auraBonus(t, [t, near]).damage).toBe(0.2);
    expect(auraBonus(t, [t, far]).damage).toBe(0);
  });
});
