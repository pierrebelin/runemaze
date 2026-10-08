import { describe, expect, it } from 'vitest';
import { gleanerCost } from '../../../src/domain/rules/gleanerCost';
import { GLEANER } from '../../../src/domain/catalog/ether';
import { BUILDERS } from '../../../src/domain/catalog/builders';

describe('gleanerCost', () => {
  it('[RM-12] coûte 40 or pour la Guilde et 50 pour les autres bâtisseurs', () => {
    expect(gleanerCost(GLEANER.cost, BUILDERS.guild)).toBe(40);
    expect(gleanerCost(GLEANER.cost, BUILDERS.bastion)).toBe(50);
  });
});
