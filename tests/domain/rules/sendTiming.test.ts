import { describe, expect, it } from 'vitest';
import { sendDelay } from '../../../src/domain/rules/sendTiming';

describe('sendTiming', () => {
  it('[RM-01] fait sortir 3 envois à 0 s, 2,93 s et 5,87 s quand la vague dure 8,8 s', () => {
    expect(sendDelay(0, 3, 8.8)).toBeCloseTo(0, 2);
    expect(sendDelay(1, 3, 8.8)).toBeCloseTo(2.93, 2);
    expect(sendDelay(2, 3, 8.8)).toBeCloseTo(5.87, 2);
  });

  it('[RM-02] espace les envois de 0,8 s quand la vague n\'a qu\'un chef', () => {
    expect(sendDelay(0, 3, 0)).toBeCloseTo(0, 2);
    expect(sendDelay(1, 3, 0)).toBeCloseTo(0.8, 2);
    expect(sendDelay(2, 3, 0)).toBeCloseTo(1.6, 2);
  });

  it('[RM-02] espace les envois de 0,8 s quand la vague est trop courte pour les répartir', () => {
    // 2 / 5 = 0,4 s < 0,8 s
    [0, 0.8, 1.6, 2.4, 3.2].forEach((attendu, k) => {
      expect(sendDelay(k, 5, 2)).toBeCloseTo(attendu, 2);
    });
  });
});
