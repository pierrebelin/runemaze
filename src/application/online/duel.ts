import { dispatch } from '../dispatch';
import type { Command, Difficulty, MapDef } from '../../domain/model/types';
import { CommandType } from '../../domain/model/types';
import { World } from '../../domain/model/World';
import { snapshot } from '../../domain/model/snapshot';
import type { WorldSnapshot } from '../../domain/model/snapshot';
import { fingerprint } from '../../domain/rules/fingerprint';
import { duelOutcome, DuelOutcome } from '../../domain/rules/duelOutcome';
import type { DuelSide } from '../../domain/rules/duelOutcome';
import { LAG_TICKS, LOST_LIMIT_MS } from './heldGame';
import { ServerMessageType, Verdict } from './protocol';
import type { ServerMessage } from './protocol';

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
  nicks: [string, string];
  tokens: [string, string];
  builders: [string, string];
}

export interface SeatMessage {
  seat: Seat;
  msg: ServerMessage;
}

/** Copie de la carte vue par l'adversaire : l'éther reste secret (le monde serveur n'est pas touché). */
function rivalSnapshot(world: World): WorldSnapshot {
  return { ...snapshot(world), ether: 0 };
}

/** Duel : fait avancer deux mondes sur une même horloge temps réel, ×1, sans pause, par pas commun. */
export class Duel {
  readonly worlds: [World, World];

  private clock = 0;
  private lastNow: number;
  private outcome: DuelOutcome = DuelOutcome.Running;
  private announced = false;
  /** Issue obtenue par abandon du siège coupé plutôt que par les cartes. */
  private forfeited = false;
  private lastRivalAt: number;
  private readonly nicks: [string, string];
  private readonly tokens: [string, string];
  private readiness: [boolean, boolean] = [false, false];
  /** Dernière vague connue, pour détecter un franchissement par compte à rebours sur n'importe quel chemin. */
  private lastWave: number;
  /** Vrai dès qu'une vague a franchi le compte à rebours sans que `advance` l'ait encore annoncée. */
  private waveLaunched = false;
  /** Sièges dont la carte a reçu un envoi, à recaler à la prochaine annonce. */
  private receivers = new Set<Seat>();
  /** Instant et siège de la coupure ; tant que `lostAt` est défini, l'horloge commune ne rattrape plus le temps réel. */
  lostAt?: number;
  lostSeat?: Seat;

  constructor(config: DuelConfig, now: number) {
    const options = { map: config.map, difficulty: config.difficulty, seed: config.seed, duel: true };
    this.worlds = [
      new World({ ...options, builder: config.builders[Seat.Host] }),
      new World({ ...options, builder: config.builders[Seat.Guest] }),
    ];
    this.lastNow = now;
    this.lastRivalAt = now;
    this.nicks = config.nicks;
    this.tokens = config.tokens;
    this.lastWave = this.worlds[Seat.Host].wave;
  }

  /** Rattrape l'horloge commune ; annonce une seule fois l'issue du duel à chaque siège. */
  advance(now: number): SeatMessage[] {
    this.tick(now);
    this.worlds[0].drainEvents();
    this.worlds[1].drainEvents();
    if (this.announced) return [];
    if (!this.isOver() && this.expired(now)) this.forfeit();
    if (this.outcome === DuelOutcome.Running) {
      const messages = this.rivalMessages(now);
      if (this.waveLaunched) {
        this.waveLaunched = false;
        messages.push(
          { seat: Seat.Host, msg: { t: ServerMessageType.Readiness, self: this.readiness[Seat.Host], rival: this.readiness[Seat.Guest] } },
          { seat: Seat.Guest, msg: { t: ServerMessageType.Readiness, self: this.readiness[Seat.Guest], rival: this.readiness[Seat.Host] } },
        );
      }
      for (const seat of this.receivers) {
        messages.push({ seat, msg: { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[seat]) } });
      }
      this.receivers.clear();
      return messages;
    }
    this.announced = true;
    if (this.forfeited) {
      const stayed = this.lostSeat === Seat.Host ? Seat.Guest : Seat.Host;
      return [{ seat: stayed, msg: this.overMessage(stayed) }];
    }
    return [
      { seat: Seat.Host, msg: this.overMessage(Seat.Host) },
      { seat: Seat.Guest, msg: this.overMessage(Seat.Guest) },
    ];
  }

  /** Vue périodique de la carte adverse : un `Rival` par siège au plus une fois par `RIVAL_VIEW_MS`. */
  private rivalMessages(now: number): SeatMessage[] {
    if (now - this.lastRivalAt < RIVAL_VIEW_MS) return [];
    this.lastRivalAt = now;
    return [
      { seat: Seat.Host, msg: { t: ServerMessageType.Rival, nick: this.nicks[Seat.Guest], snapshot: rivalSnapshot(this.worlds[Seat.Guest]) } },
      { seat: Seat.Guest, msg: { t: ServerMessageType.Rival, nick: this.nicks[Seat.Host], snapshot: rivalSnapshot(this.worlds[Seat.Host]) } },
    ];
  }

  ready(seat: Seat, now: number): SeatMessage[] {
    if (this.lostAt !== undefined) return [];
    this.tick(now);
    if (this.isOver()) return [];
    this.readiness[seat] = !this.readiness[seat];
    const rival = seat === Seat.Host ? Seat.Guest : Seat.Host;
    if (this.readiness[Seat.Host] && this.readiness[Seat.Guest]) {
      this.readiness = [false, false];
      dispatch(this.worlds[Seat.Host], { c: CommandType.CallWave });
      dispatch(this.worlds[Seat.Guest], { c: CommandType.CallWave });
      this.lastWave = this.worlds[Seat.Host].wave;
      return [
        { seat: Seat.Host, msg: { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[Seat.Host]) } },
        { seat: Seat.Guest, msg: { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[Seat.Guest]) } },
      ];
    }
    const messages: SeatMessage[] = [
      { seat, msg: { t: ServerMessageType.Readiness, self: this.readiness[seat], rival: this.readiness[rival] } },
      { seat: rival, msg: { t: ServerMessageType.Readiness, self: this.readiness[rival], rival: this.readiness[seat] } },
    ];
    this.waveLaunched = false;
    return messages;
  }

  lose(seat: Seat, now: number): SeatMessage[] {
    this.tick(now);
    if (this.isOver() || this.lostAt !== undefined) return [];
    this.lostAt = now;
    this.lostSeat = seat;
    const rival = seat === Seat.Host ? Seat.Guest : Seat.Host;
    return [{ seat: rival, msg: { t: ServerMessageType.Frozen, remainingMs: LOST_LIMIT_MS } }];
  }

  /** Retour du joueur coupé : le temps gelé ne compte pas, l'horloge repart de `now`. */
  back(seat: Seat, token: string, now: number): SeatMessage[] | ServerMessage {
    if (token !== this.tokens[seat]) return { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG };
    if (this.expired(now)) return { t: ServerMessageType.Refused, reason: GAME_OVER_MSG };
    this.lastNow = now;
    this.lostAt = undefined;
    this.lostSeat = undefined;
    return [Seat.Host, Seat.Guest].map((s) => ({
      seat: s,
      msg: {
        t: ServerMessageType.Thawed,
        seat: s,
        snapshot: snapshot(this.worlds[s]),
        rival: rivalSnapshot(this.worlds[s === Seat.Host ? Seat.Guest : Seat.Host]),
      },
    }));
  }

  /** Vrai quand la coupure a dépassé la marge tolérée. */
  expired(now: number): boolean {
    return this.lostAt !== undefined && now - this.lostAt > LOST_LIMIT_MS;
  }

  private forfeit(): void {
    this.forfeited = true;
    this.outcome = this.lostSeat === Seat.Host ? DuelOutcome.GuestWins : DuelOutcome.HostWins;
  }

  isOver(): boolean {
    return this.outcome !== DuelOutcome.Running;
  }

  order(seat: Seat, msg: { tick: number; cmd: Command; fingerprint: string }, now: number): ServerMessage | null {
    if (this.lostAt !== undefined) return { t: ServerMessageType.Drift, snapshot: snapshot(this.worlds[seat]) };
    this.tick(now);
    const overLimit = this.stepBounded(seat, msg.tick);
    const world = this.worlds[seat];
    if (msg.cmd.c === CommandType.CallWave) {
      return { t: ServerMessageType.Drift, snapshot: snapshot(world) };
    }
    const r = dispatch(world, msg.cmd);
    if (r.ok && msg.cmd.c === CommandType.Send) {
      const rival = seat === Seat.Host ? Seat.Guest : Seat.Host;
      dispatch(this.worlds[rival], { c: CommandType.Receive, creep: msg.cmd.creep });
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
    while (!this.isOver()) {
      let stepped = false;
      for (const world of this.worlds) {
        if (world.tick < target && !world.isOver()) {
          world.step();
          stepped = true;
        }
      }
      this.updateOutcome();
      this.checkWaveLaunched();
      if (!stepped) break;
    }
  }

  /** Efface les demandes de prêt dès qu'une vague part par compte à rebours, quel que soit le chemin qui a avancé les mondes. */
  private checkWaveLaunched(): void {
    const wave = this.worlds[Seat.Host].wave;
    if (wave === this.lastWave) return;
    this.lastWave = wave;
    this.readiness = [false, false];
    this.waveLaunched = true;
  }

  private updateOutcome(): void {
    this.outcome = duelOutcome(this.side(Seat.Host), this.side(Seat.Guest));
  }

  private side(seat: Seat): DuelSide {
    const world = this.worlds[seat];
    return { phase: world.phase };
  }

  private overMessage(seat: Seat): ServerMessage {
    const rival = seat === Seat.Host ? Seat.Guest : Seat.Host;
    return {
      t: ServerMessageType.DuelOver,
      verdict: this.verdictFor(seat),
      snapshot: snapshot(this.worlds[seat]),
      rival: rivalSnapshot(this.worlds[rival]),
    };
  }

  private verdictFor(seat: Seat): Verdict {
    if (this.forfeited) return Verdict.Forfeit;
    if (this.outcome === DuelOutcome.Draw) return Verdict.Draw;
    const winner = this.outcome === DuelOutcome.HostWins ? Seat.Host : Seat.Guest;
    return seat === winner ? Verdict.Victory : Verdict.Defeat;
  }
}
