import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { launchWave, waveDuration, WAVE_GAP } from '../../../src/domain/systems/waves';
import { applyDamage } from '../../../src/domain/systems/combat';
import { WAVES, waveAt } from '../../../src/domain/catalog/creeps';
import type { WaveDef } from '../../../src/domain/model/types';
import { killAllCreeps, newDuelWorld, newWorld, run } from '../../support/helpers';
import { GameEventType, Phase } from '../../../src/domain/model/types';

// Vague de substitution : un seul Limon (se scinde en 2 petits Limons à sa mort).
const SLIME_WAVE: WaveDef = {
  groups: [{ creep: 'slime', count: 1, interval: 1, delay: 0 }],
};

// Vague mixte de substitution : rat immédiat ×2, loup retardé (4s) ×3.
const MIXED_WAVE: WaveDef = {
  groups: [
    { creep: 'rat', count: 2, interval: 1, delay: 0 },
    { creep: 'wolf', count: 3, interval: 0.5, delay: 4 },
  ],
};

describe('waves', () => {
  let original: WaveDef;

  beforeEach(() => {
    original = WAVES[0];
    WAVES[0] = MIXED_WAVE;
  });

  afterEach(() => {
    WAVES[0] = original;
  });

  it('[RM-01] fait apparaître chaque groupe au bout de son délai de départ puis à son intervalle', () => {
    const w = newWorld();
    launchWave(w);

    run(w, 0.5);
    expect(w.creeps.filter((c) => c.def.id === 'rat')).toHaveLength(1);
    expect(w.creeps.filter((c) => c.def.id === 'wolf')).toHaveLength(0);

    run(w, 1.5); // total 2s : délai du loup (4s) pas encore écoulé
    expect(w.creeps.filter((c) => c.def.id === 'rat')).toHaveLength(2);
    expect(w.creeps.filter((c) => c.def.id === 'wolf')).toHaveLength(0);

    run(w, 2.25); // total 4,25s : premier loup apparu, à mi-chemin du suivant
    expect(w.creeps.filter((c) => c.def.id === 'rat')).toHaveLength(2);
    expect(w.creeps.filter((c) => c.def.id === 'wolf')).toHaveLength(1);

    run(w, 0.5); // total 4,75s : deuxième loup apparu
    expect(w.creeps.filter((c) => c.def.id === 'rat')).toHaveLength(2);
    expect(w.creeps.filter((c) => c.def.id === 'wolf')).toHaveLength(2);
  });

  it('[RM-01] fait apparaître le nombre de créatures de chaque groupe quand la vague est mixte', () => {
    const w = newWorld();
    launchWave(w);

    run(w, 6);

    expect(w.creeps.filter((c) => c.def.id === 'rat')).toHaveLength(2);
    expect(w.creeps.filter((c) => c.def.id === 'wolf')).toHaveLength(3);
  });

  it('[RM-01] fixe la vague suivante après l’apparition du groupe le plus tardif', () => {
    const w = newWorld();
    launchWave(w);

    const expectedMax = 4 + (3 - 1) * 0.5; // fin du groupe loup, plus tardif que le groupe rat
    expect(w.nextWaveIn).toBe(expectedMax + WAVE_GAP);
    expect(waveDuration(0)).toBe(expectedMax);
  });

  it('[RM-01] multiplie chaque groupe par 1,2 en mode infini sauf un chef seul', () => {
    const looped = waveAt(30);
    expect(looped.groups[0].creep).toBe(WAVES[10].groups[0].creep);
    expect(looped.groups[0].count).toBe(Math.round(WAVES[10].groups[0].count * 1.2));

    const bossOnly = waveAt(39);
    expect(bossOnly.groups[0].creep).toBe('hydra');
    expect(bossOnly.groups[0].count).toBe(1);
  });

  it('[RM-01] lance la vague 31 au bout du compte à rebours quand la vague 30 est repoussée', () => {
    const w = newWorld();
    w.lives = 1e6;
    w.wave = 28;
    launchWave(w); // vague 30 (index 29)
    expect(w.wave).toBe(29);
    expect(Number.isFinite(w.nextWaveIn)).toBe(true);

    run(w, w.nextWaveIn + 0.1);

    expect(w.wave).toBe(30);
  });

  it('[RM-02] laisse la partie en cours quand la vague 30 est repoussée', () => {
    const w = newWorld();
    w.lives = 1e6;
    w.wave = 28;
    launchWave(w);
    run(w, waveDuration(29) + 0.5);

    killAllCreeps(w);
    run(w, 0.05);

    expect(w.phase).toBe(Phase.Playing);
  });

  it('[RM-01] verse toujours prime et intérêts quand la partie est en solo', () => {
    const w = newWorld();
    launchWave(w);
    run(w, 6);

    expect(w.creeps).toHaveLength(5); // 2 rats + 3 loups tous apparus
    w.gold = 1000; // intérêts = min(floor(1000 × 0,04), 20 + 0 × 2) = min(40, 20) = 20
    const goldBefore = w.gold;

    killAllCreeps(w);
    run(w, 0.05);

    const cleared = w.events.filter((e) => e.t === GameEventType.WaveCleared);
    expect(cleared).toHaveLength(1);
    const ev = cleared[0] as { bonus: number; interest: number; income: number };
    expect(ev.interest).toBe(20);
    expect(ev.income).toBe(0);
    expect(w.gold - goldBefore).toBe(ev.bonus + ev.interest);
  });

  it('[RM-02] verse la prime plus le revenu, sans intérêts, quand une vague de duel est repoussée', () => {
    const w = newDuelWorld();
    launchWave(w);
    run(w, 6);
    w.income = 15;
    w.gold = 1000; // en solo : intérêts = min(40, 20) = 20
    const goldBefore = w.gold;

    killAllCreeps(w);
    run(w, 0.05);

    const cleared = w.events.filter((e) => e.t === GameEventType.WaveCleared);
    expect(cleared).toHaveLength(1);
    const ev = cleared[0] as { bonus: number; interest: number; income: number };
    expect(ev.interest).toBe(0);
    expect(ev.income).toBe(15);
    expect(w.gold - goldBefore).toBe(ev.bonus + 15);
  });

  /** Lance la vague 0, fait apparaître toutes les créatures puis les tue : la vague est repoussée. */
  function repousseVague(w: ReturnType<typeof newWorld>): void {
    launchWave(w);
    run(w, 6);
    killAllCreeps(w);
    run(w, 0.05);
  }

  it('[RM-10] rend autant de vies que le niveau de Remparts quand une vague est repoussée', () => {
    const w = newWorld('normal');
    w.lives = 10;
    w.gate.ramparts = 3;

    repousseVague(w);

    expect(w.lives).toBe(13);
  });

  it('[RM-10] plafonne aux vies de départ : 21 vies et non 22 en Vétéran avec Remparts 3 et 19 vies', () => {
    const w = newWorld('normal');
    w.lives = 19;
    w.gate.ramparts = 3;

    repousseVague(w);

    expect(w.lives).toBe(21);
  });

  it('[RM-10] ne rend aucune vie quand les Remparts sont au niveau 0', () => {
    const sans = newWorld('normal');
    sans.lives = 10;
    sans.gate.ramparts = 0;
    const avec = newWorld('normal');
    avec.lives = 10;
    avec.gate.ramparts = 2;

    repousseVague(sans);
    repousseVague(avec);

    expect(sans.lives).toBe(10);
    expect(avec.lives).toBe(12);
  });

  it('[RM-02] ne termine pas la vague quand un groupe retardé n’est pas encore apparu', () => {
    const w = newWorld();
    launchWave(w);
    run(w, 0.5); // avant l'apparition du groupe loup (délai 4s)

    killAllCreeps(w); // tue les rats déjà apparus
    run(w, 0.05);

    const cleared = w.events.filter((e) => e.t === GameEventType.WaveCleared);
    expect(cleared).toHaveLength(0);
    expect(w.pending.get(0)).toBeGreaterThan(0);
  });

  it('[RM-02] ne verse la prime de fin de vague qu’après la mort des petits Limons', () => {
    WAVES[0] = SLIME_WAVE;
    const w = newWorld();
    launchWave(w);
    run(w, 0.1); // le Limon apparaît

    const slime = w.creeps.find((c) => c.def.id === 'slime')!;
    expect(slime).toBeDefined();
    applyDamage(w, slime, 9999, 'chaos', -1, true); // tue le Limon, fait naître 2 petits Limons
    run(w, 1 / 60); // fusionne les rejetons dans world.creeps

    expect(w.creeps.filter((c) => c.def.id === 'slimelet')).toHaveLength(2);
    let cleared = w.events.filter((e) => e.t === GameEventType.WaveCleared);
    expect(cleared).toHaveLength(0);

    killAllCreeps(w);
    run(w, 0.05);

    cleared = w.events.filter((e) => e.t === GameEventType.WaveCleared);
    expect(cleared).toHaveLength(1);
  });

  it('[RM-05] fige au lancement les envois achetés et reçus, puis vide les files', () => {
    const w = newWorld();
    w.sent = ['rat', 'wolf'];
    w.sends = ['wolf', 'slime', 'rat'];

    launchWave(w);

    expect(w.waveSends).toEqual({ sent: ['rat', 'wolf'], received: ['wolf', 'slime', 'rat'] });
    expect(w.sent).toEqual([]);
    expect(w.sends).toEqual([]);
  });

  it('[RM-05] laisse vides les envois de la vague quand le joueur n’a rien envoyé ni reçu', () => {
    const w = newWorld();
    w.waveSends = { sent: ['rat'], received: ['wolf'] }; // vague précédente

    launchWave(w);

    expect(w.waveSends).toEqual({ sent: [], received: [] });
    expect(w.sent).toEqual([]);
    expect(w.sends).toEqual([]);
  });
});
