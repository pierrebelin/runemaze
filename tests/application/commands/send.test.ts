import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newDuelWorld, newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';
import { MAP_CROSSING } from '../../support/maps';
import { Rng } from '../../../src/domain/Rng';
import { World } from '../../../src/domain/model/World';

const newWorldWith = (rivals: number, seed: number) =>
  new World({ map: MAP_CROSSING, difficulty: 'normal', seed, duel: true, rivals, builder: 'bastion' });

describe('send', () => {
  it('[CU-02] débite 10 éther, laisse l\'or intact et augmente le revenu de 2 quand le joueur envoie un rat', () => {
    const w = newDuelWorld();
    w.ether = 100;
    const gold = w.gold;
    const income = w.income;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r.ok).toBe(true);
    expect(w.ether).toBe(90);
    expect(w.gold).toBe(gold);
    expect(w.income - income).toBe(2);
  });

  it('[RM-06] ajoute tout le gain au revenu quand le revenu dépasse l\'ancien plafond', () => {
    const w = newDuelWorld();
    w.ether = 100;
    w.income = 40;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r.ok).toBe(true);
    expect(w.income).toBe(42);
  });

  it('[CU-02] journalise l\'envoi accepté', () => {
    const w = newDuelWorld();
    w.ether = 100;

    dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(w.log).toEqual([{ tick: w.tick, cmd: { c: CommandType.Send, creep: 'rat' } }]);
  });

  it('[CU-02] refuse avec « Pas assez d\'éther. » et laisse l\'état inchangé quand l\'éther manque, même avec de l\'or', () => {
    const w = newDuelWorld();
    w.gold = 1000;
    w.ether = 9;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r).toEqual({ ok: false, reason: 'Pas assez d\'éther.' });
    expect(w.ether).toBe(9);
    expect(w.gold).toBe(1000);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-03] accepte l\'envoi d\'un Golem quand la vague 30 est lancée', () => {
    const w = newDuelWorld();
    w.wave = 29;
    w.ether = 1000;

    const r = dispatch(w, { c: CommandType.Send, creep: 'golem' });

    expect(r.ok).toBe(true);
  });

  it('[RM-01] refuse l\'envoi en solo', () => {
    const w = newWorld();
    w.ether = 100;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r).toEqual({ ok: false, reason: 'L\'envoi n\'existe qu\'en duel.' });
    expect(w.gold).toBe(gold);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('refuse l\'envoi d\'une créature non envoyable', () => {
    const w = newDuelWorld();
    w.ether = 100;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'ogre' });

    expect(r).toEqual({ ok: false, reason: 'Créature impossible à envoyer.' });
    expect(w.gold).toBe(gold);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-05] retient chaque envoi acheté dans l\'ordre d\'achat', () => {
    const w = newDuelWorld();
    w.wave = 29;
    w.ether = 1000;

    dispatch(w, { c: CommandType.Send, creep: 'rat' });
    dispatch(w, { c: CommandType.Send, creep: 'golem' });
    dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(w.sent).toEqual([{ creep: 'rat', to: 0 }, { creep: 'golem', to: 0 }, { creep: 'rat', to: 0 }]);
  });

  it('[RM-05] ne retient rien quand l\'envoi est refusé faute d\'éther', () => {
    const w = newDuelWorld();
    w.ether = 10;

    dispatch(w, { c: CommandType.Send, creep: 'rat' });
    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r.ok).toBe(false);
    expect(w.sent).toEqual([{ creep: 'rat', to: 0 }]);
  });

  it('[RM-05] note l\'adversaire tiré (0 ou 1) avec la créature achetée quand la carte a deux adversaires', () => {
    const w = newWorldWith(2, 7);
    w.ether = 1000;

    dispatch(w, { c: CommandType.Send, creep: 'rat' });
    dispatch(w, { c: CommandType.Send, creep: 'rat' });
    dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(w.sent).toHaveLength(3);
    for (const s of w.sent) {
      expect(s.creep).toBe('rat');
      expect([0, 1]).toContain(s.to);
    }
  });

  it('[RM-12] tire les mêmes adversaires pour la même graine et les mêmes envois', () => {
    const play = () => {
      const w = newWorldWith(2, 7);
      w.ether = 1000;
      for (let i = 0; i < 6; i++) dispatch(w, { c: CommandType.Send, creep: 'rat' });
      return w.sent;
    };

    const rng = new Rng(7);
    const expected = Array.from({ length: 6 }, () => ({ creep: 'rat', to: rng.int(2) }));

    expect(play()).toEqual(expected);
    expect(play()).toEqual(play());
  });

  it('[RM-05] envoie les 4 créatures chez le même adversaire avec la graine 10', () => {
    const w = newWorldWith(2, 10);
    w.ether = 1000;

    for (let i = 0; i < 4; i++) dispatch(w, { c: CommandType.Send, creep: 'rat' });

    // Graine 10 : les quatre premiers tirages de `int(2)` donnent 1.
    expect(w.sent).toEqual(Array(4).fill({ creep: 'rat', to: 1 }));
  });

  it('[RM-05] ne tire rien et note l\'adversaire 0 quand la carte n\'a qu\'un adversaire (duel)', () => {
    const w = newWorldWith(1, 7);
    const twin = newWorldWith(1, 7);
    w.ether = 100;

    dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(w.sent).toEqual([{ creep: 'rat', to: 0 }]);
    expect(w.rng.next()).toBe(twin.rng.next());
  });
});
