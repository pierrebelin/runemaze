import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { newWorld, run } from '../../support/helpers';
import { CommandType, GameEventType, Phase } from '../../../src/domain/model/types';

describe('resign', () => {
  it('[RM-08] termine la partie par une défaite quand le joueur abandonne', () => {
    const w = newWorld();
    run(w, 1);
    const lives = w.lives;
    w.drainEvents();

    const r = dispatch(w, { c: CommandType.Resign });

    expect(r.ok).toBe(true);
    expect(w.phase).toBe(Phase.Defeat);
    expect(w.lives).toBe(lives);
    expect(w.drainEvents()).toEqual([{ t: GameEventType.Defeat }]);
  });

  it('[RM-08] journalise l\'abandon et le rejeu du journal aboutit à la même défaite', () => {
    const w = newWorld('normal', 7);
    run(w, 2);
    dispatch(w, { c: CommandType.Resign });
    expect(w.log).toEqual([{ tick: w.tick, cmd: { c: CommandType.Resign } }]);

    const replay = newWorld('normal', 7);
    for (const entry of w.log) {
      while (replay.tick < entry.tick) replay.step();
      expect(dispatch(replay, entry.cmd).ok).toBe(true);
    }

    expect(replay.phase).toBe(Phase.Defeat);
    expect(fingerprint(replay)).toBe(fingerprint(w));
  });

  it('[RM-08] la simulation n\'avance plus et tout ordre est refusé quand la partie est abandonnée', () => {
    const w = newWorld();
    dispatch(w, { c: CommandType.Resign });
    const tick = w.tick;
    const gold = w.gold;

    run(w, 2);
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 1 });

    expect(w.tick).toBe(tick);
    expect(r).toEqual({ ok: false, reason: 'La partie est terminée.' });
    expect(w.gold).toBe(gold);
    expect(w.log).toHaveLength(1);
  });

  it('[RM-08] refuse l\'abandon quand la partie est déjà terminée', () => {
    const w = newWorld();
    expect(dispatch(w, { c: CommandType.Resign }).ok).toBe(true);
    w.drainEvents();

    const r = dispatch(w, { c: CommandType.Resign });

    expect(r).toEqual({ ok: false, reason: 'La partie est terminée.' });
    expect(w.log).toHaveLength(1);
    expect(w.drainEvents()).toEqual([]);
  });
});
