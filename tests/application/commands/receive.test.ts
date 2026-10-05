import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { bountyFor, clearBonus, CREEPS } from '../../../src/domain/catalog/creeps';
import { creepHp, launchWave, WAVE_GAP, waveDuration } from '../../../src/domain/systems/waves';
import { CommandType } from '../../../src/domain/model/types';
import { killAllCreeps, newDuelWorld, run } from '../../support/helpers';

const receive = (creep: string) => ({ c: CommandType.Receive, creep }) as const;

describe('receive', () => {
  it('[RM-04] fait sortir les envois après la dernière créature de la vague, dans l\'ordre d\'achat, à 0,8 s d\'intervalle', () => {
    const w = newDuelWorld();
    expect(dispatch(w, receive('wolf'))).toEqual({ ok: true });
    expect(dispatch(w, receive('rat'))).toEqual({ ok: true });
    launchWave(w);

    const seen = new Set<number>();
    const spawns: { id: string; time: number }[] = [];
    for (let i = 0; i < 12 * 60; i++) {
      w.step();
      for (const c of w.creeps) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          spawns.push({ id: c.def.id, time: w.time });
        }
      }
    }

    expect(spawns.map((s) => s.id)).toEqual([...Array(12).fill('rat'), 'wolf', 'rat']);
    expect(Math.abs(spawns[12].time - spawns[11].time - 0.8)).toBeLessThan(0.05);
    expect(Math.abs(spawns[13].time - spawns[12].time - 0.8)).toBeLessThan(0.05);
  });

  it('[RM-05] donne à l\'envoi les PV, la prime et les vies perdues d\'une créature du même type à la vague qui l\'accueille', () => {
    const w = newDuelWorld();
    dispatch(w, receive('wolf'));
    launchWave(w);

    run(w, 10);

    const sent = w.creeps.find((c) => c.def.id === 'wolf');
    expect(sent).toBeDefined();
    expect(sent!.wave).toBe(0);
    expect(sent!.maxHp).toBe(creepHp(w, CREEPS.wolf, 0));
    expect(sent!.hp).toBe(creepHp(w, CREEPS.wolf, 0));
    expect(sent!.bounty).toBe(bountyFor(0, CREEPS.wolf));
    expect(sent!.def.leak).toBe(CREEPS.wolf.leak);
  });

  it('[RM-04] ne termine la vague et ne verse sa prime qu\'une fois ses envois tués ou sortis', () => {
    const w = newDuelWorld();
    dispatch(w, receive('rat'));
    launchWave(w);
    run(w, 9);
    killAllCreeps(w);
    const gold = w.gold;

    run(w, 0.3);
    expect(w.gold).toBe(gold);
    expect(w.pending.has(0)).toBe(true);

    run(w, 1);
    killAllCreeps(w);
    run(w, 0.05);
    expect(w.gold - gold).toBe(clearBonus(0));
    expect(w.pending.has(0)).toBe(false);
  });

  it('[RM-04] garde le compte à rebours de la vague suivante quand des envois l\'accompagnent', () => {
    const w = newDuelWorld();
    dispatch(w, receive('rat'));
    dispatch(w, receive('wolf'));

    launchWave(w);

    expect(w.nextWaveIn).toBe(waveDuration(0) + WAVE_GAP);
  });

  it('[RM-04] vide la file d\'envois au lancement de la vague', () => {
    const w = newDuelWorld();
    launchWave(w);
    dispatch(w, receive('rat'));
    expect(w.sends).toEqual(['rat']);

    launchWave(w);

    expect(w.sends).toEqual([]);
    expect(w.spawners.filter((s) => s.wave === 1 && s.creep === 'rat')).toHaveLength(1);
    expect(w.spawners.filter((s) => s.wave === 0 && s.creep === 'rat').length).toBeLessThanOrEqual(1);
  });

  it('refuse la réception quand la dernière vague est déjà lancée', () => {
    const w = newDuelWorld();
    w.wave = w.campaignLength - 1;

    const r = dispatch(w, receive('rat'));

    expect(r).toEqual({ ok: false, reason: 'Plus aucune vague à venir.' });
    expect(w.sends).toEqual([]);
    expect(w.log).toHaveLength(0);
  });
});
