import { Phase } from '../model/types';

export interface DuelSide {
  phase: Phase;
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

  return DuelOutcome.Running;
}
