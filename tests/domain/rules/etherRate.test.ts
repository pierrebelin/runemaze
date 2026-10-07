import { describe, expect, it } from 'vitest';
import { etherPerMinute } from '../../../src/domain/rules/etherRate';
import { GLEANER } from '../../../src/domain/catalog/ether';

describe('etherRate', () => {
  it('[RM-07] annonce 12 éther par minute quand le joueur a un glaneur', () => {
    expect(etherPerMinute(1, GLEANER.period)).toBe(12);
  });

  it('[RM-07] annonce 24 éther par minute quand le joueur a deux glaneurs', () => {
    expect(etherPerMinute(2, GLEANER.period)).toBe(24);
  });

  it('[RM-07] annonce 0 éther par minute quand le joueur n\'a aucun glaneur', () => {
    expect(etherPerMinute(0, GLEANER.period)).toBe(0);
  });
});
