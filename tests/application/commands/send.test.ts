import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newDuelWorld, newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('send', () => {
  it('[CU-01] débite le prix et augmente le revenu quand le joueur en duel envoie un rat', () => {
    const w = newDuelWorld();
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r.ok).toBe(true);
    expect(gold - w.gold).toBe(7);
    expect(w.income).toBe(1);
  });

  it('[RM-03] débite l\'or sans dépasser le plafond quand le revenu est déjà au plafond', () => {
    const w = newDuelWorld();
    w.gold = 1000;
    for (let i = 0; i < 5; i++) dispatch(w, { c: CommandType.Send, creep: 'rat' });
    expect(w.income).toBe(5);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'wolf' });

    expect(r.ok).toBe(true);
    expect(w.income).toBe(6);
    expect(gold - w.gold).toBe(14);
    expect(1000 - w.gold).toBe(5 * 7 + 14);
  });

  it('[CU-01] journalise l\'envoi accepté', () => {
    const w = newDuelWorld();

    dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(w.log).toEqual([{ tick: w.tick, cmd: { c: CommandType.Send, creep: 'rat' } }]);
  });

  it('[CU-01] refuse l\'envoi sans rien changer quand l\'or manque', () => {
    const w = newDuelWorld();
    w.gold = 6;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r).toEqual({ ok: false, reason: 'Pas assez d\'or.' });
    expect(w.gold).toBe(6);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('[CU-01] refuse l\'envoi quand la dernière vague est déjà lancée', () => {
    const w = newDuelWorld();
    w.wave = w.campaignLength - 1;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r).toEqual({ ok: false, reason: 'Plus aucune vague à venir.' });
    expect(w.gold).toBe(gold);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-01] refuse l\'envoi en solo', () => {
    const w = newWorld();
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'rat' });

    expect(r).toEqual({ ok: false, reason: 'L\'envoi n\'existe qu\'en duel.' });
    expect(w.gold).toBe(gold);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });

  it('refuse l\'envoi d\'une créature non envoyable', () => {
    const w = newDuelWorld();
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Send, creep: 'ogre' });

    expect(r).toEqual({ ok: false, reason: 'Créature impossible à envoyer.' });
    expect(w.gold).toBe(gold);
    expect(w.income).toBe(0);
    expect(w.log).toHaveLength(0);
  });
});
