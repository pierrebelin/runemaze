import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { GLEANER } from '../../../src/domain/catalog/ether';
import { newDuelWorld, newWorld, run } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('gleaner', () => {
  it('[RM-02] démarre à 0 glaneur et 0 éther quand le duel commence', () => {
    const w = newDuelWorld();

    expect(w.ether).toBe(0);
    expect(w.gleaners).toEqual([]);
  });

  it('[CU-01] débite 50 or et ajoute un glaneur quand le joueur en duel en achète un', () => {
    const w = newDuelWorld();
    run(w, 1);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Gleaner });

    expect(r.ok).toBe(true);
    expect(gold - w.gold).toBe(GLEANER.cost);
    expect(GLEANER.cost).toBe(50);
    expect(w.gleaners).toEqual([w.tick]);
  });

  it('[CU-01] journalise l\'achat accepté', () => {
    const w = newDuelWorld();

    dispatch(w, { c: CommandType.Gleaner });

    expect(w.log).toEqual([{ tick: w.tick, cmd: { c: CommandType.Gleaner } }]);
  });

  it('[CU-01] refuse avec « Pas assez d\'or. » et laisse l\'état inchangé quand l\'or manque', () => {
    const w = newDuelWorld();
    w.gold = 49;

    const r = dispatch(w, { c: CommandType.Gleaner });

    expect(r).toEqual({ ok: false, reason: 'Pas assez d\'or.' });
    expect(w.gold).toBe(49);
    expect(w.gleaners).toEqual([]);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-01] refuse l\'achat de glaneur quand la partie est en solo', () => {
    const w = newWorld();
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Gleaner });

    expect(r).toEqual({ ok: false, reason: 'Les glaneurs n\'existent qu\'en duel.' });
    expect(w.gold).toBe(gold);
    expect(w.gleaners).toEqual([]);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-12] donne la même empreinte quand le même journal avec achats de glaneurs est rejoué sur la même graine', () => {
    const play = () => {
      const w = newDuelWorld('normal', 42);
      w.gold = 1000;
      dispatch(w, { c: CommandType.Gleaner });
      run(w, 1);
      dispatch(w, { c: CommandType.Gleaner });
      run(w, 6);
      return w;
    };
    const a = play();
    const b = play();
    expect(a.ether).toBeGreaterThan(0);

    expect(fingerprint(b)).toBe(fingerprint(a));

    b.ether++;
    expect(fingerprint(b)).not.toBe(fingerprint(a));
  });
});
