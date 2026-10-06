import { describe, expect, it } from 'vitest';
import { rampBonus } from '../../../src/domain/rules/attackSpeed';

describe('attackSpeed', () => {
  it('[RM-09] donne 1 % de vitesse d\'attaque par seconde avec une cible, plafonné au maximum', () => {
    expect(rampBonus(0, 1)).toBe(0);
    expect(rampBonus(30, 1)).toBeCloseTo(0.3);
    expect(rampBonus(100, 1)).toBeCloseTo(1);
    expect(rampBonus(500, 1)).toBe(1);
    expect(rampBonus(100, 1.5)).toBeCloseTo(1);
    expect(rampBonus(500, 1.5)).toBe(1.5);
  });
});
