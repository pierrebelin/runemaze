import { describe, expect, it } from 'vitest';
import { waveReward } from '../../../src/domain/rules/waveReward';

describe('waveReward', () => {
  it('[RM-05] verse la prime et 4 % de l\'or en intérêts quand la partie n\'est pas un duel', () => {
    expect(waveReward(10, 5, 200, 7, false)).toEqual({ bonus: 10, interest: 8, income: 0, capped: false });
  });

  it('[RM-05] plafonne les intérêts et le signale quand l\'or est élevé', () => {
    // vague 5 : plafond 20 + 5 × 2 = 30 ; 4 % de 1000 = 40
    expect(waveReward(10, 5, 1000, 7, false)).toEqual({ bonus: 10, interest: 30, income: 0, capped: true });
  });

  it('[RM-05] verse la prime et le revenu sans intérêts quand la partie est un duel', () => {
    expect(waveReward(10, 5, 1000, 7, true)).toEqual({ bonus: 10, interest: 0, income: 7, capped: false });
  });
});
