import { describe, expect, it } from 'vitest';
import { incomeCap, raiseIncome } from '../../../src/domain/rules/income';

describe('income', () => {
  it('[RM-03] plafonne le revenu à 6 avant la vague 1, 24 à la vague 10, 44 à la vague 20', () => {
    expect(incomeCap(1)).toBe(6);
    expect(incomeCap(10)).toBe(24);
    expect(incomeCap(20)).toBe(44);
  });

  it('[RM-03] ajoute le gain quand le revenu reste sous le plafond', () => {
    expect(raiseIncome(2, 2, 5)).toBe(4);
  });

  it('[RM-03] arrête le revenu au plafond quand le gain le dépasserait', () => {
    expect(raiseIncome(5, 2, 1)).toBe(6);
  });

  it('[RM-03] ne baisse jamais le revenu quand il dépasse déjà le plafond', () => {
    expect(raiseIncome(10, 2, 1)).toBe(10);
  });
});
