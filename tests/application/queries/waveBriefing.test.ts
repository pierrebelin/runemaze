import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { groupSends, waveBriefing } from '../../../src/application/queries/waveBriefing';
import { CREEPS, WAVES } from '../../../src/domain/catalog/creeps';
import type { WaveDef } from '../../../src/domain/model/types';
import { launchWave, creepHp } from '../../../src/domain/systems/waves';
import { newDuelWorld, newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

// Vague mixte sans chef : loups ×3 (délai 0) puis rats ×2 (délai 3).
const MIXED_WAVE: WaveDef = {
  groups: [
    { creep: 'wolf', count: 3, interval: 0.8, delay: 0 },
    { creep: 'rat', count: 2, interval: 0.8, delay: 3 },
  ],
};

// Vague mixte avec chef : loups ×3 puis ogre chef ×1 en 2e groupe.
const MIXED_WAVE_WITH_BOSS: WaveDef = {
  groups: [
    { creep: 'wolf', count: 3, interval: 0.8, delay: 0 },
    { creep: 'ogre', count: 1, interval: 0.8, delay: 3 },
  ],
};

describe('waveBriefing', () => {
  let original: WaveDef;

  beforeEach(() => {
    original = WAVES[0];
  });

  afterEach(() => {
    WAVES[0] = original;
  });

  it('[RM-03] annonce chaque groupe avec sa créature, son nombre et ses PV', () => {
    WAVES[0] = MIXED_WAVE;
    const w = newWorld();
    const b = waveBriefing(w);
    expect(b.wave).toBe(0);

    expect(b.groups[0].creep.id).toBe('wolf');
    expect(b.groups[0].count).toBe(3);
    expect(b.groups[0].hp).toBe(creepHp(w, b.groups[0].creep, 0));

    expect(b.groups[1].creep.id).toBe('rat');
    expect(b.groups[1].count).toBe(2);
    expect(b.groups[1].hp).toBe(creepHp(w, b.groups[1].creep, 0));

    launchWave(w);
    w.step();
    expect(w.creeps[0].maxHp).toBe(b.groups[0].hp);
  });

  it('[RM-03] place le chef en premier quand la vague a un chef', () => {
    WAVES[0] = MIXED_WAVE_WITH_BOSS;
    const w = newWorld();
    const b = waveBriefing(w);

    expect(b.groups[0].creep.id).toBe('ogre');
    expect(b.groups[1].creep.id).toBe('wolf');
  });

  it('[RM-04] annonce les mêmes groupes avec ou sans envois reçus', () => {
    const w = newDuelWorld();
    const without = waveBriefing(w);

    dispatch(w, { c: CommandType.Receive, creep: 'wolf', from: 0 });
    dispatch(w, { c: CommandType.Receive, creep: 'rat', from: 0 });

    expect(w.sends).toHaveLength(2);
    expect(waveBriefing(w)).toEqual(without);
  });

  it('[RM-01] annonce la vague 31 quand la vague 30 est lancée', () => {
    const w = newWorld();
    w.wave = 29;

    const b = waveBriefing(w);

    expect(b.wave).toBe(30);
  });

  it('[RM-07] décrit la vague demandée quand un numéro de vague est donné', () => {
    const w = newWorld();
    const ref = newWorld();
    ref.wave = 4;
    const expected = waveBriefing(ref);

    const b = waveBriefing(w, 5);

    expect(b.wave).toBe(5);
    expect(b).toEqual(expected);
    expect(b).not.toEqual(waveBriefing(w));
  });

  it('[RM-05] regroupe les envois par créature dans l\'ordre du premier achat', () => {
    // Ordre du premier achat ≠ ordre alphabétique ≠ ordre du catalogue.
    const groups = groupSends(['wolf', 'rat', 'wolf', 'harpy', 'rat', 'wolf']);

    expect(groups).toEqual([
      { creep: CREEPS.wolf, count: 3 },
      { creep: CREEPS.rat, count: 2 },
      { creep: CREEPS.harpy, count: 1 },
    ]);
  });
});
