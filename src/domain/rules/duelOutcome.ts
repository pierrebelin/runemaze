import { Phase } from '../model/types';

export interface DuelSide {
  phase: Phase;
  lives: number;
}

export enum DuelOutcome {
  Running = 'running',
  HostWins = 'hostWins',
  GuestWins = 'guestWins',
  Draw = 'draw',
}

export function duelOutcome(host: DuelSide, guest: DuelSide): DuelOutcome {
  const hostDefeated = host.phase === Phase.Defeat;
  const guestDefeated = guest.phase === Phase.Defeat;
  if (hostDefeated && guestDefeated) return DuelOutcome.Draw;
  if (hostDefeated) return DuelOutcome.GuestWins;
  if (guestDefeated) return DuelOutcome.HostWins;

  if (host.phase === Phase.Victory && guest.phase === Phase.Victory) {
    if (host.lives > guest.lives) return DuelOutcome.HostWins;
    if (guest.lives > host.lives) return DuelOutcome.GuestWins;
    return DuelOutcome.Draw;
  }

  return DuelOutcome.Running;
}
