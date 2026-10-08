import { describe, expect, it } from 'vitest';
import { tradeIncome } from '../../../src/domain/rules/trade';
import { TOWERS } from '../../../src/domain/catalog/towers';

describe('trade', () => {
  it('[RM-11] additionne le revenu de toutes les tours, sans plafond', () => {
    const counter = { def: { ...TOWERS.wall, trade: 6 } };
    const bank = { def: { ...TOWERS.wall, trade: 18 } };
    const caravan = { def: { ...TOWERS.wall, trade: 10 } };
    const plain = { def: TOWERS.archer };

    expect(tradeIncome([counter, plain, bank, plain, caravan])).toBe(34);
    expect(tradeIncome(Array.from({ length: 100 }, () => bank))).toBe(1800);
    expect(tradeIncome([plain])).toBe(0);
    expect(tradeIncome([])).toBe(0);
  });
});
