import { describe, expect, it } from 'vitest';
import { sharedReserve } from '../../../src/domain/rules/sharedReserve';

describe('sharedReserve', () => {
  it('[RM-06] vaut 60, 42 et 20 vies pour 30, 21 et 10 vies solo (Recrue, Vétéran, Légende)', () => {
    expect(sharedReserve(30)).toBe(60);
    expect(sharedReserve(21)).toBe(42);
    expect(sharedReserve(10)).toBe(20);
  });
});
