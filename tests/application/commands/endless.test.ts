import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newWorld } from '../../support/helpers';
import { CommandType, Phase } from '../../../src/domain/model/types';

describe('endless', () => {
  it('[RM-10] relance les vagues en mode infini quand la campagne est gagnée', () => {
    const w = newWorld();
    w.phase = Phase.Victory;

    const r = dispatch(w, { c: CommandType.Endless });

    expect(r.ok).toBe(true);
    expect(w.endless).toBe(true);
    expect(w.phase).not.toBe(Phase.Victory);
  });

  it('[RM-04] journalise l\'ordre de mode infini pour le rejeu', () => {
    const w = newWorld();
    w.phase = Phase.Victory;
    const tick = w.tick;

    dispatch(w, { c: CommandType.Endless });

    expect(w.log).toContainEqual({ tick, cmd: { c: CommandType.Endless } });
  });

  it('[RM-10] refuse le mode infini quand la campagne n\'est pas gagnée', () => {
    const w = newWorld();
    const log = [...w.log];

    const r = dispatch(w, { c: CommandType.Endless });

    expect(r).toEqual({ ok: false, reason: 'La campagne n\'est pas encore gagnée.' });
    expect(w.endless).toBe(false);
    expect(w.log).toEqual(log);
  });

  it('[RM-10] refuse le mode infini quand la partie est perdue', () => {
    const w = newWorld();
    w.phase = Phase.Defeat;
    const log = [...w.log];

    const r = dispatch(w, { c: CommandType.Endless });

    expect(r.ok).toBe(false);
    expect(w.endless).toBe(false);
    expect(w.log).toEqual(log);
  });
});
