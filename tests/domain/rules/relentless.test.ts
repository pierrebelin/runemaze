import { describe, expect, it } from 'vitest';
import { relentlessBonus } from '../../../src/domain/rules/relentless';

describe('relentless', () => {
  it('[RM-04] ajoute 10 % par coup consécutif jusqu\'à +150 %', () => {
    expect(relentlessBonus(0, 0.1, 1.5)).toBe(0);
    expect(relentlessBonus(5, 0.1, 1.5)).toBeCloseTo(0.5);
    expect(relentlessBonus(15, 0.1, 1.5)).toBeCloseTo(1.5);
    expect(relentlessBonus(30, 0.1, 1.5)).toBe(1.5);
  });
});
