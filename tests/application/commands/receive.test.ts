import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { bountyFor, clearBonus, CREEPS } from '../../../src/domain/catalog/creeps';
import { creepHp, launchWave, WAVE_GAP, waveDuration } from '../../../src/domain/systems/waves';
import { CommandType } from '../../../src/domain/model/types';
import { killAllCreeps, newDuelWorld, observeSpawns, run } from '../../support/helpers';

const receive = (creep: string) => ({ c: CommandType.Receive, creep }) as const;

describe('receive', () => {
  it('[RM-01] fait sortir le premier envoi avec la première créature et les suivants répartis sur la vague, dans l\'ordre d\'achat', () => {
    const w = newDuelWorld();
    expect(dispatch(w, receive('wolf'))).toEqual({ ok: true });
    expect(dispatch(w, receive('raider'))).toEqual({ ok: true });
    launchWave(w);

    const spawns = observeSpawns(w, 10);
    const sent = spawns.filter((s) => s.id !== 'rat');

    // Vague 0 : durée 8,8 s, 2 envois → écart 4,4 s.
    expect(sent.map((s) => s.id)).toEqual(['wolf', 'raider']);
    expect(Math.abs(sent[0].time - spawns[0].time)).toBeLessThan(0.05);
    expect(Math.abs(sent[1].time - spawns[0].time - 4.4)).toBeLessThan(0.05);
  });

  it('[RM-02] fait sortir les envois toutes les 0,8 s à partir du chef quand la vague 20 n\'a que l\'Hydre', () => {
    const w = newDuelWorld();
    w.wave = 18;
    dispatch(w, receive('rat'));
    dispatch(w, receive('wolf'));
    dispatch(w, receive('raider'));
    launchWave(w);

    const spawns = observeSpawns(w, 4);

    expect(spawns.map((s) => s.id)).toEqual(['hydra', 'rat', 'wolf', 'raider']);
    expect(Math.abs(spawns[1].time - spawns[0].time)).toBeLessThan(0.05);
    expect(Math.abs(spawns[2].time - spawns[0].time - 0.8)).toBeLessThan(0.05);
    expect(Math.abs(spawns[3].time - spawns[0].time - 1.6)).toBeLessThan(0.05);
  });

  it('[RM-07] donne à l\'envoi les PV, la prime et les vies perdues d\'une créature du même type à la vague qui l\'accueille', () => {
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

  it('[RM-03] ne termine la vague qu\'une fois ses envois répartis tués ou sortis', () => {
    const w = newDuelWorld();
    w.wave = 18;
    dispatch(w, receive('rat'));
    dispatch(w, receive('rat'));
    dispatch(w, receive('rat'));
    launchWave(w);
    run(w, 1);
    killAllCreeps(w);
    const gold = w.gold;

    run(w, 0.3);
    expect(w.gold).toBe(gold);
    expect(w.pending.has(19)).toBe(true);

    run(w, 0.5);
    killAllCreeps(w);
    run(w, 0.05);
    expect(w.gold - gold).toBe(clearBonus(19));
    expect(w.pending.has(19)).toBe(false);
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

  it('[RM-03] accepte la réception quand la vague 30 est lancée', () => {
    const w = newDuelWorld();
    w.wave = 29;

    const r = dispatch(w, receive('rat'));

    expect(r.ok).toBe(true);
    expect(w.sends).toEqual(['rat']);
  });
});
