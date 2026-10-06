import { describe, expect, it } from 'vitest';
import { duelOutcome, DuelOutcome } from '../../../src/domain/rules/duelOutcome';
import { Phase } from '../../../src/domain/model/types';

describe('duelOutcome', () => {
  it('[RM-09] donne la victoire à l\'invité quand l\'hôte tombe à 0 vie', () => {
    expect(
      duelOutcome({ phase: Phase.Defeat }, { phase: Phase.Playing }),
    ).toBe(DuelOutcome.GuestWins);
    expect(
      duelOutcome({ phase: Phase.Playing }, { phase: Phase.Defeat }),
    ).toBe(DuelOutcome.HostWins);
  });

  it('[RM-09] déclare l\'égalité quand les deux tombent à 0 vie au même tick', () => {
    expect(
      duelOutcome({ phase: Phase.Defeat }, { phase: Phase.Defeat }),
    ).toBe(DuelOutcome.Draw);
  });

  it('[RM-02] laisse le duel en cours tant qu\'aucune Porte n\'est tombée', () => {
    expect(duelOutcome({ phase: Phase.Playing }, { phase: Phase.Playing })).toBe(DuelOutcome.Running);
  });
});
