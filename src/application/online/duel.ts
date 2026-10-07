import { dispatch } from '../dispatch';
import type { Command, Difficulty, MapDef } from '../../domain/model/types';
import { CommandType, Phase } from '../../domain/model/types';
import { World } from '../../domain/model/World';
import { snapshot } from '../../domain/model/snapshot';
import type { WorldSnapshot } from '../../domain/model/snapshot';
import { DIFFICULTY } from '../../domain/catalog/creeps';
import { fingerprint } from '../../domain/rules/fingerprint';
import { duelOutcome, DuelOutcome } from '../../domain/rules/duelOutcome';
import type { DuelSide } from '../../domain/rules/duelOutcome';
import { sharedReserve } from '../../domain/rules/sharedReserve';
import { LAG_TICKS, LOST_LIMIT_MS } from './heldGame';
import { Mode, ServerMessageType, Team, Verdict } from './protocol';
import type { OtherMap, ServerMessage } from './protocol';

export const RIVAL_VIEW_MS = 200;
export const CODE_TAKEN_MSG = 'Code invalide ou partie déjà commencée.';
export const GAME_OVER_MSG = 'La partie est terminée.';

export enum Seat {
  Host = 0,
  Guest = 1,
}

export interface DuelConfig {
  map: MapDef;
  difficulty: Difficulty;
  seed: number;
  nicks: string[];
  tokens: string[];
  builders: string[];
  mode?: Mode;
}

const TEAMS: Record<Mode, Team[]> = {
  [Mode.Duel]: [Team.A, Team.B],
  [Mode.Coop]: [Team.A, Team.A],
  [Mode.Teams]: [Team.A, Team.A, Team.B, Team.B],
};

export function teamOf(mode: Mode, seat: number): Team {
  return TEAMS[mode][seat];
}

export function rivalSeats(mode: Mode, seat: number): number[] {
  const team = teamOf(mode, seat);
  return TEAMS[mode].map((_, s) => s).filter((s) => teamOf(mode, s) !== team);
}

export interface SeatMessage {
  seat: number;
  msg: ServerMessage;
}

/** Copie de la carte vue par l'adversaire : l'éther reste secret (le monde serveur n'est pas touché). */
function rivalSnapshot(world: World): WorldSnapshot {
  return { ...snapshot(world), ether: 0 };
}

/** Duel : fait avancer deux mondes sur une même horloge temps réel, ×1, sans pause, par pas commun. */
export class Duel {
  readonly worlds: World[];

  private clock = 0;
  private lastNow: number;
  private outcome: DuelOutcome = DuelOutcome.Running;
  private announced = false;
  /** Issue obtenue par abandon du siège coupé plutôt que par les cartes. */
  private forfeited = false;
  private lastRivalAt: number;
  private readonly mode: Mode;
  private readonly nicks: string[];
  private readonly tokens: string[];
  /** Sièges dont la carte a reçu un envoi, à recaler à la prochaine annonce. */
  private receivers = new Set<Seat>();
  /** Instant de la première coupure et sièges absents, par ordre de coupure ; tant que `lostAt` est défini, l'horloge commune ne rattrape plus le temps réel. */
  lostAt?: number;
  lostSeats: number[] = [];

  constructor(config: DuelConfig, now: number) {
    const coop = config.mode === Mode.Coop;
    this.mode = config.mode ?? Mode.Duel;
    const options = {
      map: config.map,
      difficulty: config.difficulty,
      seed: config.seed,
      duel: !coop,
      ...(coop && { lives: sharedReserve(DIFFICULTY[config.difficulty].lives) }),
    };
    this.worlds = config.builders.map((builder, seat) => new World({ ...options, builder, rivals: rivalSeats(this.mode, seat).length || 1 }));
    this.lastNow = now;
    this.lastRivalAt = now;
    this.nicks = config.nicks;
    this.tokens = config.tokens;
  }

  /** Rattrape l'horloge commune ; annonce une seule fois l'issue du duel à chaque siège. */
  advance(now: number): SeatMessage[] {
    this.tick(now);
    for (const world of this.worlds) world.drainEvents();
    if (this.announced) return [];
    if (!this.isOver() && this.expired(now)) this.forfeit();
    if (this.outcome === DuelOutcome.Running) {
      const messages = this.rivalMessages(now);
      for (const seat of this.receivers) {
        messages.push({ seat, msg: { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[seat]) } });
      }
      this.receivers.clear();
      return messages;
    }
    this.announced = true;
    if (this.forfeited) {
      return this.worlds.flatMap((_, seat) => (this.lostSeats.includes(seat) ? [] : [{ seat, msg: this.overMessage(seat) }]));
    }
    return this.worlds.map((_, seat) => ({ seat, msg: this.overMessage(seat) }));
  }

  /** Vue périodique de la carte adverse : un `Rival` par siège au plus une fois par `RIVAL_VIEW_MS`. */
  private rivalMessages(now: number): SeatMessage[] {
    if (now - this.lastRivalAt < RIVAL_VIEW_MS) return [];
    this.lastRivalAt = now;
    return this.worlds.flatMap((_, seat) =>
      this.others(seat).map((o) => ({ seat, msg: { t: ServerMessageType.Rival as const, ...o } })),
    );
  }

  /** Les autres cartes vues depuis un siège, éther masqué, par siège croissant. */
  private others(seat: number): OtherMap[] {
    return this.worlds.flatMap((world, s) => (s === seat ? [] : [{ seat: s, nick: this.nicks[s], snapshot: rivalSnapshot(world) }]));
  }

  lose(seat: number, now: number): SeatMessage[] {
    this.tick(now);
    if (this.isOver()) return [];
    const first = this.lostAt === undefined;
    if (first) this.lostAt = now;
    this.lostSeats.push(seat);
    if (!first) return [];
    return this.worlds.flatMap((_, s) =>
      s === seat ? [] : [{ seat: s, msg: { t: ServerMessageType.Frozen as const, remainingMs: LOST_LIMIT_MS } }],
    );
  }

  /** Siège absent dont le jeton correspond, s'il y en a un. */
  lostSeatOf(token: string): number | undefined {
    return this.lostSeats.find((s) => this.tokens[s] === token);
  }

  /** Retour d'un joueur coupé : le temps gelé ne compte pas ; la partie ne repart que quand plus personne ne manque. */
  back(seat: number, token: string, now: number): SeatMessage[] | ServerMessage {
    if (token !== this.tokens[seat]) return { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG };
    if (this.expired(now)) return { t: ServerMessageType.Refused, reason: GAME_OVER_MSG };
    const thaw = (s: number): SeatMessage => ({
      seat: s,
      msg: { t: ServerMessageType.Thawed, seat: s, snapshot: snapshot(this.worlds[s]), others: this.others(s) },
    });
    this.lostSeats = this.lostSeats.filter((s) => s !== seat);
    if (this.lostSeats.length > 0) {
      const remainingMs = LOST_LIMIT_MS - (now - this.lostAt!);
      return [thaw(seat), { seat, msg: { t: ServerMessageType.Frozen, remainingMs } }];
    }
    this.lastNow = now;
    this.lostAt = undefined;
    return this.worlds.map((_, s) => thaw(s));
  }

  /** Vrai quand la coupure a dépassé la marge tolérée. */
  expired(now: number): boolean {
    return this.lostAt !== undefined && now - this.lostAt > LOST_LIMIT_MS;
  }

  private forfeit(): void {
    this.forfeited = true;
    this.outcome = teamOf(this.mode, this.lostSeats[0]) === Team.A ? DuelOutcome.GuestWins : DuelOutcome.HostWins;
  }

  isOver(): boolean {
    return this.outcome !== DuelOutcome.Running;
  }

  order(seat: Seat, msg: { tick: number; cmd: Command; fingerprint: string }, now: number): ServerMessage | null {
    if (this.lostAt !== undefined) return { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[seat]) };
    this.tick(now);
    const overLimit = this.stepBounded(seat, msg.tick);
    const world = this.worlds[seat];
    const r = dispatch(world, msg.cmd);
    if (r.ok && msg.cmd.c === CommandType.Send) {
      const rival = rivalSeats(this.mode, seat)[world.sent[world.sent.length - 1].to];
      dispatch(this.worlds[rival], { c: CommandType.Receive, creep: msg.cmd.creep, from: seat });
      this.receivers.add(rival);
    }
    if (overLimit || !r.ok || fingerprint(world) !== msg.fingerprint) {
      return { t: ServerMessageType.Drift, snapshot: snapshot(world) };
    }
    return null;
  }

  check(seat: Seat, msg: { tick: number; fingerprint: string }, now: number): ServerMessage | null {
    if (this.lostAt !== undefined) return { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[seat]) };
    this.tick(now);
    const overLimit = this.stepBounded(seat, msg.tick);
    const world = this.worlds[seat];
    if (overLimit || fingerprint(world) !== msg.fingerprint) {
      return { t: ServerMessageType.Drift, snapshot: snapshot(world) };
    }
    return null;
  }

  /** Avance les deux cartes jusqu'au tick annoncé par ce siège, plafonné à la marge ; signale un dépassement. */
  private stepBounded(seat: Seat, tick: number): boolean {
    const limit = this.limit();
    const target = Math.min(tick, limit);
    const late = target < this.worlds[seat].tick;
    if (!late) this.advanceTo(target);
    return late || tick > limit;
  }

  /** Borne d'avance tolérée pour un tick annoncé par le joueur : coût du rattrapage plafonné. */
  private limit(): number {
    return Math.floor(this.clock) + LAG_TICKS;
  }

  /** Avance l'horloge temps réel puis rattrape les deux mondes. */
  private tick(now: number): void {
    if (this.lostAt !== undefined) return;
    this.clock += ((now - this.lastNow) * 60) / 1000;
    this.lastNow = now;
    this.advanceTo(this.clock - LAG_TICKS);
  }

  /** Avance les deux mondes par pas commun jusqu'à `target` ; s'arrête dès que le duel a une issue ou que plus rien n'avance. */
  private advanceTo(target: number): void {
    // une carte déjà défaite hors pas (réserve partagée) fige les quatre cartes avant tout nouveau pas
    this.updateOutcome();
    while (!this.isOver()) {
      let stepped = false;
      const before = this.worlds.map((world) => world.lives);
      for (const world of this.worlds) {
        if (world.tick < target && !world.isOver()) {
          world.step();
          stepped = true;
        }
      }
      this.shareLeaks(before);
      this.updateOutcome();
      if (!stepped) break;
    }
  }

  /** Réserve d'équipe : la perte d'une carte pendant le pas est répercutée sur ses coéquipiers, via dispatch (journal). */
  private shareLeaks(before: number[]): void {
    // pertes relevées avant tout envoi, pour ne pas recopier une perte reçue
    const losses = this.worlds.map((world, seat) => before[seat] - world.lives);
    losses.forEach((loss, seat) => {
      if (loss <= 0) return;
      for (const mate of this.teammatesOf(seat)) {
        dispatch(this.worlds[mate], { c: CommandType.ReserveLoss, lives: loss });
        this.receivers.add(mate);
      }
    });
  }

  private teammatesOf(seat: number): number[] {
    const team = teamOf(this.mode, seat);
    return TEAMS[this.mode].map((_, s) => s).filter((s) => s !== seat && teamOf(this.mode, s) === team);
  }

  private updateOutcome(): void {
    this.outcome = duelOutcome(this.side(Team.A), this.side(Team.B));
  }

  /** Une équipe est défaite dès qu'une de ses cartes l'est. */
  private side(team: Team): DuelSide {
    const defeated = this.worlds.some((world, seat) => teamOf(this.mode, seat) === team && world.phase === Phase.Defeat);
    return { phase: defeated ? Phase.Defeat : Phase.Playing };
  }

  private overMessage(seat: number): ServerMessage {
    return {
      t: ServerMessageType.DuelOver,
      verdict: this.verdictFor(seat),
      snapshot: snapshot(this.worlds[seat]),
      others: this.others(seat),
    };
  }

  private verdictFor(seat: number): Verdict {
    if (this.mode === Mode.Coop) return Verdict.Defeat;
    if (this.outcome === DuelOutcome.Draw) return Verdict.Draw;
    const winner = this.outcome === DuelOutcome.HostWins ? Team.A : Team.B;
    if (teamOf(this.mode, seat) !== winner) return Verdict.Defeat;
    return this.forfeited ? Verdict.Forfeit : Verdict.Victory;
  }
}
