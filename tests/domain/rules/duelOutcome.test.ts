import { describe, expect, it } from 'vitest';
import { duelOutcome, DuelOutcome } from '../../../src/domain/rules/duelOutcome';
import { Phase } from '../../../src/domain/model/types';

describe('duelOutcome', () => {
  it('[RM-09] donne la victoire à l\'invité quand l\'hôte tombe à 0 vie', () => {
    expect(
      duelOutcome({ phase: Phase.Defeat, lives: 0 }, { phase: Phase.Playing, lives: 12 }),
    ).toBe(DuelOutcome.GuestWins);
    expect(
      duelOutcome({ phase: Phase.Playing, lives: 12 }, { phase: Phase.Defeat, lives: 0 }),
    ).toBe(DuelOutcome.HostWins);
  });

  it('[RM-09] déclare l\'égalité quand les deux tombent à 0 vie au même tick', () => {
    expect(
      duelOutcome({ phase: Phase.Defeat, lives: 0 }, { phase: Phase.Defeat, lives: 0 }),
    ).toBe(DuelOutcome.Draw);
  });

  it('[RM-10] attend l\'autre carte quand une seule a fini la dernière vague', () => {
    expect(
      duelOutcome({ phase: Phase.Victory, lives: 10 }, { phase: Phase.Playing, lives: 12 }),
    ).toBe(DuelOutcome.Running);
  });

  it('[RM-10] donne la victoire au plus de vies quand les deux ont fini la campagne', () => {
    expect(
      duelOutcome({ phase: Phase.Victory, lives: 10 }, { phase: Phase.Victory, lives: 7 }),
    ).toBe(DuelOutcome.HostWins);
    expect(
      duelOutcome({ phase: Phase.Victory, lives: 7 }, { phase: Phase.Victory, lives: 10 }),
    ).toBe(DuelOutcome.GuestWins);
  });

  it('[RM-10] déclare l\'égalité à vies égales en fin de campagne', () => {
    expect(
      duelOutcome({ phase: Phase.Victory, lives: 10 }, { phase: Phase.Victory, lives: 10 }),
    ).toBe(DuelOutcome.Draw);
  });
});
