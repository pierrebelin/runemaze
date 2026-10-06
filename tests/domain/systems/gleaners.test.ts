import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { launchWave } from '../../../src/domain/systems/waves';
import { CommandType } from '../../../src/domain/model/types';
import { newDuelWorld, run } from '../../support/helpers';

describe('gleaners', () => {
  it('[RM-03] produit 1 éther 5 s après l\'achat, pas avant', () => {
    const w = newDuelWorld();
    w.gold = 1000;
    dispatch(w, { c: CommandType.Gleaner });

    for (let i = 0; i < 299; i++) w.step();
    expect(w.ether).toBe(0);

    w.step();
    expect(w.ether).toBe(1);
  });

  it('[RM-03] produit pendant la préparation comme pendant une vague', () => {
    const w = newDuelWorld();
    w.gold = 1000;
    dispatch(w, { c: CommandType.Gleaner });

    run(w, 5); // préparation : la première vague n'est pas lancée
    expect(w.wave).toBe(-1);
    expect(w.ether).toBe(1);

    launchWave(w);
    run(w, 5);
    expect(w.wave).toBe(0);
    expect(w.ether).toBe(2);
  });

  it('[RM-03] cadence chaque glaneur depuis son propre achat quand deux glaneurs sont achetés à 2 s d\'écart', () => {
    const w = newDuelWorld();
    w.gold = 1000;
    dispatch(w, { c: CommandType.Gleaner });
    run(w, 2);
    dispatch(w, { c: CommandType.Gleaner });

    run(w, 3); // tick 300 : le 1er produit, le 2e pas encore
    expect(w.ether).toBe(1);

    for (let i = 0; i < 119; i++) w.step(); // tick 419
    expect(w.ether).toBe(1);

    w.step(); // tick 420 : le 2e produit, 120 ticks après le 1er
    expect(w.ether).toBe(2);
  });

  it('[RM-03] produit 3 éther en 15 s quand le joueur a un glaneur, sans limite au nombre de glaneurs', () => {
    const solo = newDuelWorld();
    solo.gold = 1000;
    dispatch(solo, { c: CommandType.Gleaner });
    run(solo, 15);
    expect(solo.ether).toBe(3);

    const many = newDuelWorld();
    many.gold = 10000;
    for (let i = 0; i < 20; i++) dispatch(many, { c: CommandType.Gleaner });
    run(many, 15);
    expect(many.gleaners).toHaveLength(20);
    expect(many.ether).toBe(60);
  });
});
