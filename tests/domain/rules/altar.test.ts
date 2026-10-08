import { describe, expect, it } from 'vitest';
import { altarBonus } from '../../../src/domain/rules/altar';

describe('altar', () => {
  it('[RM-07] donne 10 % de dégâts par cumul', () => {
    expect(altarBonus(0, 0.1)).toBe(0);
    expect(altarBonus(1, 0.1)).toBeCloseTo(0.1);
    expect(altarBonus(4, 0.1)).toBeCloseTo(0.4);
    expect(altarBonus(10, 0.1)).toBeCloseTo(1);
  });
});
