import { dispatch } from '../dispatch';
import type { Command } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { snapshot } from '../../domain/model/snapshot';
import { fingerprint } from '../../domain/rules/fingerprint';
import { ServerMessageType, Verdict } from './protocol';
import type { ServerMessage } from './protocol';

export const LAG_TICKS = 15;
/** Durée de coupure tolérée avant que la partie soit perdue par abandon. */
export const LOST_LIMIT_MS = 30_000;

/** Partie tenue par l'arbitre : le monde qu'elle fait progresser, et le jeton qui l'authentifie. */
export class HeldGame {
  readonly world: World;
  readonly token: string;

  /** Horloge temps réel, en ticks (flottant) : la partie rattrape ce cap avec un léger retard (`LAG_TICKS`). */
  private clock = 0;
  private lastNow: number;
  private paused = false;
  /** Défaite déjà annoncée : fin définitive, annoncée une seule fois. */
  private announced = false;
  /** Instant de la coupure ; effacé au retour du joueur. Tant qu'il est défini, l'horloge ne rattrape plus le temps réel. */
  lostAt?: number;

  /** Vrai quand la coupure a dépassé la marge tolérée. */
  expired(now: number): boolean {
    return this.lostAt !== undefined && now - this.lostAt > LOST_LIMIT_MS;
  }

  constructor(world: World, token: string, now: number) {
    this.world = world;
    this.token = token;
    this.lastNow = now;
  }

  advance(now: number): ServerMessage | null {
    this.tick(now);
    this.world.drainEvents();
    if (this.world.isOver() && !this.announced) {
      this.announced = true;
      return { t: ServerMessageType.Over, verdict: Verdict.Defeat, snapshot: snapshot(this.world) };
    }
    return null;
  }

  order(msg: { tick: number; cmd: Command; fingerprint: string }, now: number): ServerMessage | null {
    this.tick(now);
    const overLimit = this.stepBounded(msg.tick);
    const r = dispatch(this.world, msg.cmd);
    if (overLimit || !r.ok || fingerprint(this.world) !== msg.fingerprint) {
      return { t: ServerMessageType.Drift, snapshot: snapshot(this.world) };
    }
    return null;
  }

  check(msg: { tick: number; fingerprint: string }, now: number): ServerMessage | null {
    this.tick(now);
    const overLimit = this.stepBounded(msg.tick);
    if (overLimit || fingerprint(this.world) !== msg.fingerprint) {
      return { t: ServerMessageType.Drift, snapshot: snapshot(this.world) };
    }
    return null;
  }

  lose(now: number): void {
    this.tick(now);
    this.lostAt = now;
  }

  back(now: number): ServerMessage {
    this.lastNow = now;
    this.lostAt = undefined;
    return { t: ServerMessageType.Resumed, snapshot: snapshot(this.world), paused: this.paused };
  }

  pace(msg: { tick: number; paused: boolean }, now: number): void {
    this.tick(now);
    this.clock = Math.min(msg.tick, this.limit());
    this.paused = msg.paused;
    this.catchUp();
  }

  /** Avance le monde jusqu'au tick annoncé, plafonné à la marge ; signale un dépassement (tardif ou trop en avance). */
  private stepBounded(tick: number): boolean {
    const limit = this.limit();
    const late = this.stepToTick(Math.min(tick, limit));
    return late || tick > limit;
  }

  /** Borne d'avance tolérée pour un tick annoncé par le joueur : coût du rattrapage plafonné. */
  private limit(): number {
    return Math.floor(this.clock) + LAG_TICKS;
  }

  /** Avance l'horloge temps réel puis rattrape le monde ; ne marque pas la fin comme annoncée. */
  private tick(now: number): void {
    if (this.lostAt !== undefined) return;
    if (!this.paused) {
      this.clock += ((now - this.lastNow) * 60) / 1000;
    }
    this.lastNow = now;
    this.catchUp();
  }

  /** Avance le monde jusqu'à `tick`, sauf s'il ne peut plus avancer (fin de partie) ; rend si l'appel était tardif. */
  private stepToTick(tick: number): boolean {
    const late = tick < this.world.tick;
    if (!late) {
      while (this.world.tick < tick && !this.world.isOver()) {
        this.world.step();
      }
    }
    return late;
  }

  /** Fait avancer le monde jusqu'à l'horloge (moins le retard voulu) ; s'arrête si la partie ne peut plus avancer. */
  private catchUp(): void {
    while (this.world.tick < this.clock - LAG_TICKS && !this.world.isOver()) {
      this.world.step();
    }
    if (this.world.isOver()) {
      this.clock = Math.min(this.clock, this.world.tick + LAG_TICKS);
    }
  }
}
