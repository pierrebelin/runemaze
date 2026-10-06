import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { newDuelWorld, newWorld, run } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('gate', () => {
  it('[CU-03] débite 20 éther, passe le Tir au niveau 3 et ajoute 5 au revenu quand le Tir est au niveau 2', () => {
    const w = newDuelWorld();
    w.ether = 100;
    w.gate.shot = 2;
    const income = w.income;

    const r = dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });

    expect(r.ok).toBe(true);
    expect(w.ether).toBe(80);
    expect(w.gate.shot).toBe(3);
    expect(w.income - income).toBe(5);
  });

  it('[RM-08] garde un niveau propre à chaque amélioration quand le joueur achète Tir puis Remparts', () => {
    const w = newDuelWorld();
    w.ether = 100;

    dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });
    dispatch(w, { c: CommandType.Gate, upgrade: 'ramparts' });

    expect(w.gate.shot).toBe(1);
    expect(w.gate.ramparts).toBe(1);
    expect(w.ether).toBe(100 - 12 - 12);
  });

  it('[CU-03] refuse avec « Pas assez d\'éther. » et laisse l\'état inchangé quand l\'éther manque', () => {
    const w = newDuelWorld();
    w.ether = 11;

    const r = dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });

    expect(r).toEqual({ ok: false, reason: 'Pas assez d\'éther.' });
    expect(w.ether).toBe(11);
    expect(w.income).toBe(0);
    expect(w.gate.shot).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('[CU-03] refuse avec « Niveau maximal atteint. » quand le Tir est au niveau 10 ou les Remparts au niveau 5', () => {
    const w = newDuelWorld();
    w.ether = 1000;
    w.gate.shot = 10;
    w.gate.ramparts = 5;

    const shot = dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });
    const ramparts = dispatch(w, { c: CommandType.Gate, upgrade: 'ramparts' });

    expect(shot).toEqual({ ok: false, reason: 'Niveau maximal atteint.' });
    expect(ramparts).toEqual({ ok: false, reason: 'Niveau maximal atteint.' });
    expect(w.ether).toBe(1000);
    expect(w.gate.shot).toBe(10);
    expect(w.gate.ramparts).toBe(5);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-01] refuse l\'amélioration de la Porte quand la partie est en solo', () => {
    const w = newWorld();
    w.ether = 100;

    const r = dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });

    expect(r).toEqual({ ok: false, reason: 'La Porte ne s\'améliore qu\'en duel.' });
    expect(w.ether).toBe(100);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-02] démarre avec Tir et Remparts au niveau 0 quand le duel commence', () => {
    const w = newDuelWorld();

    expect(w.gate.shot).toBe(0);
    expect(w.gate.ramparts).toBe(0);
  });

  it('[RM-12] donne la même empreinte quand le même journal avec glaneurs et améliorations de Porte est rejoué sur la même graine', () => {
    const play = () => {
      const w = newDuelWorld('normal', 42);
      w.gold = 1000;
      dispatch(w, { c: CommandType.Gleaner });
      run(w, 1);
      dispatch(w, { c: CommandType.Gleaner });
      run(w, 6);
      w.ether += 100;
      dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });
      dispatch(w, { c: CommandType.Gate, upgrade: 'ramparts' });
      run(w, 2);
      return w;
    };
    const a = play();
    const b = play();
    expect(a.gate.shot).toBe(1);
    expect(a.gate.ramparts).toBe(1);

    expect(fingerprint(b)).toBe(fingerprint(a));

    b.gate.cooldown += 1;
    expect(fingerprint(b)).not.toBe(fingerprint(a));
    b.gate.cooldown = a.gate.cooldown;
    b.gate.ramparts++;
    expect(fingerprint(b)).not.toBe(fingerprint(a));
  });
});
