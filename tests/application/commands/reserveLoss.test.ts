import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { CommandType, GameEventType, Phase } from '../../../src/domain/model/types';
import { newWorld } from '../../support/helpers';

describe('reserveLoss', () => {
  it('[RM-06] retire les vies perdues à la réserve quand la perte arrive', () => {
    const w = newWorld();
    const lives = w.lives;

    const r = dispatch(w, { c: CommandType.ReserveLoss, lives: 3 });

    expect(r.ok).toBe(true);
    expect(w.lives).toBe(lives - 3);
    expect(w.phase).not.toBe(Phase.Defeat);
  });

  it('[RM-07] met la partie en défaite quand la perte vide la réserve', () => {
    const w = newWorld();

    dispatch(w, { c: CommandType.ReserveLoss, lives: w.lives + 5 });

    expect(w.lives).toBe(0);
    expect(w.phase).toBe(Phase.Defeat);
    expect(w.events.filter((e) => e.t === GameEventType.Defeat)).toHaveLength(1);
  });

  it('[RM-06] ne signale aucune fuite sur la carte qui subit la perte', () => {
    const w = newWorld();

    dispatch(w, { c: CommandType.ReserveLoss, lives: 3 });
    dispatch(w, { c: CommandType.ReserveLoss, lives: w.lives });

    expect(w.events.filter((e) => e.t === GameEventType.Leak)).toHaveLength(0);
  });
});
