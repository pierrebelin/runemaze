import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { waveBriefing } from '../../../src/application/queries/waveBriefing';
import { WAVES } from '../../../src/domain/catalog/creeps';
import type { WaveDef } from '../../../src/domain/model/types';
import { creepHp } from '../../../src/domain/systems/waves';
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
    const b = waveBriefing(w)!;
    expect(b.wave).toBe(0);

    expect(b.groups[0].creep.id).toBe('wolf');
    expect(b.groups[0].count).toBe(3);
    expect(b.groups[0].hp).toBe(creepHp(w, b.groups[0].creep, 0));

    expect(b.groups[1].creep.id).toBe('rat');
    expect(b.groups[1].count).toBe(2);
    expect(b.groups[1].hp).toBe(creepHp(w, b.groups[1].creep, 0));

    dispatch(w, { c: CommandType.CallWave });
    w.step();
    expect(w.creeps[0].maxHp).toBe(b.groups[0].hp);
  });

  it('[RM-03] place le chef en premier quand la vague a un chef', () => {
    WAVES[0] = MIXED_WAVE_WITH_BOSS;
    const w = newWorld();
    const b = waveBriefing(w)!;

    expect(b.groups[0].creep.id).toBe('ogre');
    expect(b.groups[1].creep.id).toBe('wolf');
  });

  it('[RM-06] compte les envois en approche dans l\'aperçu de la prochaine vague', () => {
    const w = newDuelWorld();
    expect(waveBriefing(w)!.incoming).toBe(0);

    dispatch(w, { c: CommandType.Receive, creep: 'wolf' });
    dispatch(w, { c: CommandType.Receive, creep: 'rat' });

    expect(waveBriefing(w)!.incoming).toBe(2);
  });

  it('ne renvoie rien quand la dernière vague de la campagne est lancée', () => {
    const w = newWorld();
    w.wave = w.campaignLength - 1;
    expect(waveBriefing(w)).toBeNull();
  });
});
