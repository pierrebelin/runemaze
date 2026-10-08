import { describe, expect, it } from 'vitest';
import { bountyPaid } from '../../../src/domain/rules/bounty';

describe('bounty', () => {
  it('[RM-10] multiplie la prime et arrondit', () => {
    expect(bountyPaid(5, 1.5)).toBe(8);
    expect(bountyPaid(7, 2)).toBe(14);
    expect(bountyPaid(7)).toBe(7);
  });
});
