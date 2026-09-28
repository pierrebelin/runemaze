import type { Difficulty, MapDef } from '../../domain/model/types';
import { Phase } from '../../domain/model/types';
import { World } from '../../domain/model/World';
import { snapshot } from '../../domain/model/snapshot';
import { HeldGame } from './heldGame';
import { ServerMessageType, Verdict } from './protocol';
import type { ServerMessage } from './protocol';

export interface OpenRequest {
  map: MapDef;
  difficulty: Difficulty;
  seed: number;
  id: string;
  token: string;
  previous?: { id: string; token: string };
}

/** Ouvre et tient les parties en ligne, chacune retrouvable par son identifiant. */
export class Referee {
  private readonly games = new Map<string, HeldGame>();

  open(req: OpenRequest, now: number): ServerMessage {
    if (req.previous && this.owns(req.previous.id, req.previous.token)) {
      this.games.delete(req.previous.id);
    }
    const world = new World({ map: req.map, difficulty: req.difficulty, seed: req.seed });
    const held = new HeldGame(world, req.token, now);
    this.games.set(req.id, held);
    return { t: ServerMessageType.Opened, id: req.id, token: req.token, snapshot: snapshot(world) };
  }

  game(id: string): HeldGame | undefined {
    return this.games.get(id);
  }

  lose(id: string, now: number): void {
    this.games.get(id)?.lose(now);
  }

  resumable(id: string, token: string, now: number): boolean {
    const held = this.games.get(id);
    return held !== undefined && held.token === token && held.lostAt !== undefined && !held.expired(now);
  }

  resume(id: string, token: string, now: number): ServerMessage {
    const held = this.games.get(id);
    if (held === undefined || held.token !== token || held.lostAt === undefined) {
      return { t: ServerMessageType.Ended };
    }
    if (held.expired(now)) {
      return { t: ServerMessageType.Over, verdict: Verdict.Abandon, snapshot: snapshot(held.world) };
    }
    return held.back(now);
  }

  sweep(now: number): string[] {
    const removed: string[] = [];
    for (const [id, held] of this.games) {
      if (held.world.phase === Phase.Defeat || held.expired(now)) {
        removed.push(id);
        this.games.delete(id);
      }
    }
    return removed;
  }

  /** Vrai quand la partie existe et que le jeton fourni la détient. */
  private owns(id: string, token: string): boolean {
    return this.games.get(id)?.token === token;
  }
}
