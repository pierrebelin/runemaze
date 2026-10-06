import { describe, expect, it } from 'vitest';
import { canBuyGleaner } from '../../../src/application/queries/canBuyGleaner';
import { GLEANER } from '../../../src/domain/catalog/ether';
import { newDuelWorld } from '../../support/helpers';

describe('canBuyGleaner', () => {
  it('[CU-01] accepte sans rien débiter quand le joueur en duel a assez d’or', () => {
    const w = newDuelWorld();
    w.gold = GLEANER.cost;

    const r = canBuyGleaner(w);

    expect(r).toEqual({ ok: true });
    expect(w.gold).toBe(GLEANER.cost);
    expect(w.gleaners).toEqual([]);
    expect(w.log).toHaveLength(0);
  });

  it('[CU-01] refuse avec « Pas assez d\'or. » quand l’or manque', () => {
    const w = newDuelWorld();
    w.gold = GLEANER.cost - 1;

    const r = canBuyGleaner(w);

    expect(r).toEqual({ ok: false, reason: 'Pas assez d\'or.' });
    expect(w.gold).toBe(GLEANER.cost - 1);
    expect(w.gleaners).toEqual([]);
    expect(w.log).toHaveLength(0);
  });
});
