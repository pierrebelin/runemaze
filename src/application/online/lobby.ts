import type { Difficulty, MapDef } from '../../domain/model/types';
import { snapshot } from '../../domain/model/snapshot';
import { DUEL_CODE_ALPHABET, Mode, ServerMessage, ServerMessageType, Team } from './protocol';
import { CODE_TAKEN_MSG, Duel, GAME_OVER_MSG, Seat } from './duel';

export { DUEL_CODE_ALPHABET };

export function duelCode(draws: number[]): string {
  return draws.map((d) => DUEL_CODE_ALPHABET[d % 24]).join('');
}

export function nickname(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  return trimmed === '' ? fallback : trimmed.slice(0, 12);
}

interface Member {
  nick: string;
  key: string;
  builder?: string;
  team?: Team;
}

/** `members[0]` est l'hôte, dans l'ordre d'arrivée. */
interface Room {
  members: Member[];
  map: MapDef;
  difficulty: Difficulty;
  mode: Mode;
}

export interface Addressed {
  key: string;
  msg: ServerMessage;
}

/** `picked` dit qui a choisi, jamais quoi : le choix reste caché jusqu'au lancement. */
function roomMessage(room: Room): ServerMessage {
  const [host, guest] = room.members;
  return {
    t: ServerMessageType.Room,
    host: host.nick,
    guest: guest?.nick ?? null,
    map: room.map,
    difficulty: room.difficulty,
    mode: room.mode,
    picked: { host: host.builder !== undefined, guest: guest?.builder !== undefined },
  };
}

function teamRoomMessage(room: Room): ServerMessage {
  const team = (t: Team) => room.members.filter((m) => m.team === t).map((m) => ({ nick: m.nick, picked: m.builder !== undefined }));
  return {
    t: ServerMessageType.TeamRoom,
    host: room.members[0].nick,
    map: room.map,
    difficulty: room.difficulty,
    teams: { [Team.A]: team(Team.A), [Team.B]: team(Team.B) },
    waiting: room.members.filter((m) => m.team === undefined).map((m) => m.nick),
  };
}

function capacity(room: Room): number {
  return room.mode === Mode.Teams ? 4 : 2;
}

/** Le salon à deux équipes diffuse sa composition, les autres modes leur message à deux places. */
function broadcast(room: Room): Addressed[] {
  const msg = room.mode === Mode.Teams ? teamRoomMessage(room) : roomMessage(room);
  return room.members.map((m) => ({ key: m.key, msg }));
}

export class Lobby {
  private readonly rooms = new Map<string, Room>();
  private readonly duels = new Map<string, Duel>();
  /** Clés de connexion des sièges de chaque duel : le salon disparaît au lancement. */
  private readonly seatKeys = new Map<string, string[]>();

  taken(code: string): boolean {
    return this.rooms.has(code) || this.duels.has(code);
  }

  host(req: { code: string; nick: string; map: MapDef; difficulty: Difficulty; key: string; mode?: Mode }): Addressed[] {
    const freed = this.leaveRoom(req.key);
    const host = nickname(req.nick, 'Hôte');
    const mode = req.mode ?? Mode.Duel;
    const room: Room = {
      members: [{ nick: host, key: req.key, ...(mode === Mode.Teams ? { team: Team.A } : {}) }],
      map: req.map,
      difficulty: req.difficulty,
      mode,
    };
    this.rooms.set(req.code, room);
    return [
      ...freed,
      { key: req.key, msg: { t: ServerMessageType.Hosted, code: req.code, host, map: req.map, difficulty: req.difficulty, mode } },
      ...(mode === Mode.Teams ? [{ key: req.key, msg: teamRoomMessage(room) }] : []),
    ];
  }

  join(req: { code: string; nick: string; key: string }): Addressed[] {
    const room = this.rooms.get(req.code);
    if (!room || room.members.length >= capacity(room) || room.members.some((m) => m.key === req.key)) {
      return [{ key: req.key, msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } }];
    }
    const freed = this.leaveRoom(req.key);
    const guest = nickname(req.nick, 'Invité');
    room.members.push({ nick: guest, key: req.key });
    return [...freed, ...broadcast(room)];
  }

  start(key: string, seed: number, tokens: string[], now: number): Addressed[] {
    for (const [code, room] of this.rooms) {
      const [host, guest] = room.members;
      if (!room.members.some((m) => m.key === key)) continue;
      if (host.key !== key) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: "Seul l'hôte peut lancer la partie." } }];
      }
      if (room.mode === Mode.Teams) return this.startTeams(code, room, seed, tokens, now);
      if (!guest) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: "En attente d'un adversaire." } }];
      }
      if (!host.builder || !guest.builder) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: 'En attente du choix des bâtisseurs.' } }];
      }
      const duel = new Duel(
        { map: room.map, difficulty: room.difficulty, seed, nicks: [host.nick, guest.nick], tokens, builders: [host.builder, guest.builder], mode: room.mode },
        now,
      );
      this.rooms.delete(code);
      this.duels.set(code, duel);
      this.seatKeys.set(code, [host.key, guest.key]);
      const hostSnap = snapshot(duel.worlds[Seat.Host]);
      const guestSnap = snapshot(duel.worlds[Seat.Guest]);
      return [
        {
          key: host.key,
          msg: {
            t: ServerMessageType.DuelStarted,
            code,
            seat: Seat.Host,
            token: tokens[Seat.Host],
            snapshot: hostSnap,
            others: [{ seat: Seat.Guest, nick: guest.nick, snapshot: guestSnap }],
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
            others: [{ seat: Seat.Host, nick: host.nick, snapshot: hostSnap }],
          },
        },
      ];
    }
    return [{ key, msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } }];
  }

  /** Sièges : équipe A dans l'ordre des membres (hôte d'abord), puis équipe B. */
  private startTeams(code: string, room: Room, seed: number, tokens: string[], now: number): Addressed[] {
    const key = room.members[0].key;
    const seated = [Team.A, Team.B].flatMap((t) => room.members.filter((m) => m.team === t));
    if (seated.length < 4) {
      return [{ key, msg: { t: ServerMessageType.Refused, reason: 'En attente de deux joueurs par équipe.' } }];
    }
    if (seated.some((m) => !m.builder)) {
      return [{ key, msg: { t: ServerMessageType.Refused, reason: 'En attente du choix des bâtisseurs.' } }];
    }
    const duel = new Duel(
      { map: room.map, difficulty: room.difficulty, seed, nicks: seated.map((m) => m.nick), tokens, builders: seated.map((m) => m.builder!), mode: room.mode },
      now,
    );
    this.rooms.delete(code);
    this.duels.set(code, duel);
    this.seatKeys.set(code, seated.map((m) => m.key));
    const snaps = duel.worlds.map((w) => snapshot(w));
    return seated.map((m, seat) => ({
      key: m.key,
      msg: {
        t: ServerMessageType.DuelStarted,
        code,
        seat,
        token: tokens[seat],
        snapshot: snaps[seat],
        others: seated.flatMap((o, s) => (s === seat ? [] : [{ seat: s, nick: o.nick, snapshot: snaps[s] }])),
      },
    }));
  }

  choose(key: string, builder: string): Addressed[] {
    for (const room of this.rooms.values()) {
      const member = room.members.find((m) => m.key === key);
      if (!member) continue;
      member.builder = builder;
      return broadcast(room);
    }
    return [];
  }

  chooseMap(key: string, map: MapDef): Addressed[] {
    for (const room of this.rooms.values()) {
      if (!room.members.some((m) => m.key === key)) continue;
      if (room.members[0].key !== key) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: "Seul l'hôte peut changer la carte." } }];
      }
      room.map = map;
      return broadcast(room);
    }
    return [];
  }

  pickTeam(key: string, team: Team): Addressed[] {
    for (const room of this.rooms.values()) {
      const member = room.members.find((m) => m.key === key);
      if (!member || room.mode !== Mode.Teams) continue;
      if (room.members.filter((m) => m !== member && m.team === team).length >= 2) {
        return [{ key, msg: { t: ServerMessageType.Refused, reason: 'Cette équipe est complète.' } }];
      }
      member.team = team;
      return broadcast(room);
    }
    return [];
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
    const seat = duel.lostSeatOf(req.token);
    const refused = [{ key: req.key, msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } as ServerMessage }];
    if (seat === undefined) return refused;
    const result = duel.back(seat, req.token, now);
    if (!Array.isArray(result)) return [{ key: req.key, msg: result }];
    const keys = [...this.seatKeys.get(req.code)!];
    keys[seat] = req.key;
    this.seatKeys.set(req.code, keys);
    return result.map((m) => ({ key: keys[m.seat], msg: m.msg }));
  }

  private leaveRoom(key: string): Addressed[] {
    for (const [code, room] of this.rooms) {
      const index = room.members.findIndex((m) => m.key === key);
      if (index === -1) continue;
      if (index === 0) {
        this.rooms.delete(code);
        return room.members.slice(1).map((m) => ({ key: m.key, msg: { t: ServerMessageType.Cancelled } }));
      }
      room.members.splice(index, 1);
      return broadcast(room);
    }
    return [];
  }
}
