import type { Difficulty, MapDef } from '../../domain/model/types';
import { snapshot } from '../../domain/model/snapshot';
import { DUEL_CODE_ALPHABET, ServerMessage, ServerMessageType } from './protocol';
import { CODE_TAKEN_MSG, Duel, GAME_OVER_MSG, Seat } from './duel';

export { DUEL_CODE_ALPHABET };

export function duelCode(draws: number[]): string {
  return draws.map((d) => DUEL_CODE_ALPHABET[d % 24]).join('');
}

export function nickname(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  return trimmed === '' ? fallback : trimmed.slice(0, 12);
}

interface Room {
  host: { nick: string; key: string };
  guest?: { nick: string; key: string };
  map: MapDef;
  difficulty: Difficulty;
}

export interface Addressed {
  key: string;
  msg: ServerMessage;
}

export class Lobby {
  private readonly rooms = new Map<string, Room>();
  private readonly duels = new Map<string, Duel>();
  /** Clés de connexion des sièges de chaque duel : le salon disparaît au lancement. */
  private readonly seatKeys = new Map<string, [string, string]>();

  taken(code: string): boolean {
    return this.rooms.has(code) || this.duels.has(code);
  }

  host(req: { code: string; nick: string; map: MapDef; difficulty: Difficulty; key: string }): Addressed[] {
    const freed = this.leaveRoom(req.key);
    const host = nickname(req.nick, 'Hôte');
    this.rooms.set(req.code, {
      host: { nick: host, key: req.key },
      map: req.map,
      difficulty: req.difficulty,
    });
    return [
      ...freed,
      { key: req.key, msg: { t: ServerMessageType.Hosted, code: req.code, host, map: req.map, difficulty: req.difficulty } },
    ];
  }

  join(req: { code: string; nick: string; key: string }): Addressed[] {
    const room = this.rooms.get(req.code);
    if (!room || room.guest || room.host.key === req.key) {
      return [{ key: req.key, msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } }];
    }
    const freed = this.leaveRoom(req.key);
    const guest = nickname(req.nick, 'Invité');
    room.guest = { nick: guest, key: req.key };
    const msg: ServerMessage = {
      t: ServerMessageType.Room,
      host: room.host.nick,
      guest,
      map: room.map,
      difficulty: room.difficulty,
    };
    return [
      ...freed,
      { key: room.host.key, msg },
      { key: room.guest.key, msg },
    ];
  }

  start(key: string, seed: number, tokens: [string, string], now: number): Addressed[] {
    for (const [code, room] of this.rooms) {
      if (room.host.key !== key && room.guest?.key !== key) continue;
      if (room.host.key !== key) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: "Seul l'hôte peut lancer la partie." } }];
      }
      if (!room.guest) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: "En attente d'un adversaire." } }];
      }
      const guest = room.guest;
      const duel = new Duel(
        { map: room.map, difficulty: room.difficulty, seed, nicks: [room.host.nick, guest.nick], tokens },
        now,
      );
      this.rooms.delete(code);
      this.duels.set(code, duel);
      this.seatKeys.set(code, [room.host.key, guest.key]);
      const hostSnap = snapshot(duel.worlds[Seat.Host]);
      const guestSnap = snapshot(duel.worlds[Seat.Guest]);
      return [
        {
          key: room.host.key,
          msg: {
            t: ServerMessageType.DuelStarted,
            code,
            seat: Seat.Host,
            token: tokens[Seat.Host],
            snapshot: hostSnap,
            rival: { nick: guest.nick, snapshot: guestSnap },
          },
        },
        {
          key: guest.key,
          msg: {
            t: ServerMessageType.DuelStarted,
            code,
            seat: Seat.Guest,
            token: tokens[Seat.Guest],
            snapshot: guestSnap,
            rival: { nick: room.host.nick, snapshot: hostSnap },
          },
        },
      ];
    }
    return [{ key, msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } }];
  }

  duel(code: string): Duel | undefined {
    return this.duels.get(code);
  }

  leave(key: string, now: number): Addressed[] {
    const freed = this.leaveRoom(key);
    for (const [code, keys] of this.seatKeys) {
      const seat = keys.indexOf(key) as Seat | -1;
      if (seat === -1) continue;
      const messages = this.duels.get(code)!.lose(seat, now);
      return [...freed, ...messages.map((m) => ({ key: keys[m.seat], msg: m.msg }))];
    }
    return freed;
  }

  sweep(now: number): void {
    for (const [code, duel] of this.duels) {
      // `main.ts` fait avancer les duels avant `sweep` : un joueur resté a déjà reçu son forfait quand la coupure expire.
      if (!duel.isOver() && !duel.expired(now)) continue;
      this.duels.delete(code);
      this.seatKeys.delete(code);
    }
  }

  rejoin(req: { code: string; token: string; key: string }, now: number): Addressed[] {
    const duel = this.duels.get(req.code);
    if (!duel) return [{ key: req.key, msg: { t: ServerMessageType.Refused, reason: GAME_OVER_MSG } }];
    const seat = duel.lostSeat;
    const refused = [{ key: req.key, msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } as ServerMessage }];
    if (seat === undefined) return refused;
    const result = duel.back(seat, req.token, now);
    if (!Array.isArray(result)) return [{ key: req.key, msg: result }];
    const keys: [string, string] = [...this.seatKeys.get(req.code)!];
    keys[seat] = req.key;
    this.seatKeys.set(req.code, keys);
    return result.map((m) => ({ key: keys[m.seat], msg: m.msg }));
  }

  private leaveRoom(key: string): Addressed[] {
    for (const [code, room] of this.rooms) {
      if (room.host.key === key) {
        this.rooms.delete(code);
        return room.guest ? [{ key: room.guest.key, msg: { t: ServerMessageType.Cancelled } }] : [];
      }
      if (room.guest?.key === key) {
        room.guest = undefined;
        return [
          {
            key: room.host.key,
            msg: { t: ServerMessageType.Room, host: room.host.nick, guest: null, map: room.map, difficulty: room.difficulty },
          },
        ];
      }
    }
    return [];
  }
}
