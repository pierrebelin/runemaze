import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newDuelWorld, newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('send', () => {
  it('[CU-02] débite 10 éther, laisse l\'or intact et augmente le revenu de 3 quand le joueur envoie un rat', () => {
    const w = newDuelWorld();
    w.ether = 100;
    const gold = w.gold;
    const income = w.income;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r.ok).toBe(true);
    expect(w.ether).toBe(90);
    expect(w.gold).toBe(gold);
    expect(w.income - income).toBe(3);
  });

  it('[RM-06] ajoute tout le gain au revenu quand le revenu dépasse l\'ancien plafond', () => {
    const w = newDuelWorld();
    w.ether = 100;
    w.income = 40;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r.ok).toBe(true);
    expect(w.income).toBe(43);
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

  it('[CU-02] refuse l\'envoi quand la dernière vague est déjà lancée', () => {
    const w = newDuelWorld();
    w.wave = w.campaignLength - 1;
    w.ether = 100;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r).toEqual({ ok: false, reason: 'Plus aucune vague à venir.' });
    expect(w.gold).toBe(gold);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
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
});
