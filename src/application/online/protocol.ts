import type { Biome, Command, Difficulty, MapDef, TargetMode } from '../../domain/model/types';
import type { WorldSnapshot } from '../../domain/model/snapshot';
import { CommandType } from '../../domain/model/types';
import { BUILDERS } from '../../domain/catalog/builders';
import { BIOMES } from '../../domain/catalog/map';
import type { Seat } from './duel';

export enum ClientMessageType {
  Open = 'open',
  Order = 'order',
  Check = 'check',
  Pace = 'pace',
  Resumable = 'resumable',
  Resume = 'resume',
  Host = 'host',
  Join = 'join',
  Leave = 'leave',
  Start = 'start',
  Rejoin = 'rejoin',
  ChooseBuilder = 'chooseBuilder',
  ChooseTeam = 'chooseTeam',
  ChooseMap = 'chooseMap',
}

export enum ServerMessageType {
  Opened = 'opened',
  Drift = 'drift',
  Over = 'over',
  Resumed = 'resumed',
  Resumable = 'resumable',
  Ended = 'ended',
  Hosted = 'hosted',
  Room = 'room',
  TeamRoom = 'teamRoom',
  Refused = 'refused',
  Cancelled = 'cancelled',
  DuelStarted = 'duelStarted',
  DuelOver = 'duelOver',
  Rival = 'rival',
  Frozen = 'frozen',
  Thawed = 'thawed',
}

export enum Mode {
  Duel = 'duel',
  Coop = 'coop',
  Teams = 'teams',
}

export enum Team {
  A = 'a',
  B = 'b',
}

export enum Verdict {
  Victory = 'victory',
  Defeat = 'defeat',
  Abandon = 'abandon',
  Draw = 'draw',
  Forfeit = 'forfeit',
}

export type ClientMessage =
  | { t: ClientMessageType.Open; map: MapDef; difficulty: Difficulty; builder: string; previous?: { id: string; token: string } }
  | { t: ClientMessageType.Order; tick: number; cmd: Command; fingerprint: string }
  | { t: ClientMessageType.Check; tick: number; fingerprint: string }
  | { t: ClientMessageType.Pace; tick: number; paused: boolean }
  | { t: ClientMessageType.Resumable; id: string; token: string }
  | { t: ClientMessageType.Resume; id: string; token: string }
  | { t: ClientMessageType.Host; nick: string; map: MapDef; difficulty: Difficulty; mode: Mode }
  | { t: ClientMessageType.Join; nick: string; code: string }
  | { t: ClientMessageType.Leave }
  | { t: ClientMessageType.Start }
  | { t: ClientMessageType.Rejoin; code: string; token: string }
  | { t: ClientMessageType.ChooseBuilder; builder: string }
  | { t: ClientMessageType.ChooseTeam; team: Team }
  | { t: ClientMessageType.ChooseMap; map: MapDef };

const TARGET_MODES: TargetMode[] = ['first', 'last', 'strong', 'weak', 'close'];
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
export const DUEL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_PATTERN = new RegExp(`^[${DUEL_CODE_ALPHABET}]{6}$`);

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isPositiveInt(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v) && v > 0;
}

function isBuilderId(v: unknown): v is string {
  return isString(v) && Object.hasOwn(BUILDERS, v);
}

function isPrevious(v: unknown): v is { id: string; token: string } {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return isString(p.id) && isString(p.token);
}

function isMapDef(v: unknown): v is MapDef {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    isString(m.id) &&
    isString(m.name) &&
    isPositiveInt(m.width) &&
    isPositiveInt(m.height) &&
    Array.isArray(m.rows) &&
    m.rows.every(isString) &&
    (m.biome === undefined || BIOMES.includes(m.biome as Biome))
  );
}

function readCommand(cmd: unknown): Command | null {
  if (typeof cmd !== 'object' || cmd === null) return null;
  const c = cmd as Record<string, unknown>;
  switch (c.c) {
    case CommandType.Build:
      if (isString(c.def) && isNumber(c.x) && isNumber(c.y)) {
        return { c: CommandType.Build, def: c.def, x: c.x, y: c.y };
      }
      return null;
    case CommandType.Upgrade:
      if (isNumber(c.tower) && isString(c.def)) {
        return { c: CommandType.Upgrade, tower: c.tower, def: c.def };
      }
      return null;
    case CommandType.Sell:
      if (isNumber(c.tower)) {
        return { c: CommandType.Sell, tower: c.tower };
      }
      return null;
    case CommandType.Target:
      if (isNumber(c.tower) && isString(c.mode) && TARGET_MODES.includes(c.mode as TargetMode)) {
        return { c: CommandType.Target, tower: c.tower, mode: c.mode as TargetMode };
      }
      return null;
    case CommandType.Send:
      if (isString(c.creep)) {
        return { c: CommandType.Send, creep: c.creep };
      }
      return null;
    case CommandType.Gleaner:
      return { c: CommandType.Gleaner };
    case CommandType.Resign:
      return { c: CommandType.Resign };
    case CommandType.Gate:
      if (c.upgrade === 'shot' || c.upgrade === 'ramparts') {
        return { c: CommandType.Gate, upgrade: c.upgrade };
      }
      return null;
    default:
      return null;
  }
}

export function readClientMessage(raw: string): ClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const m = parsed as Record<string, unknown>;

  switch (m.t) {
    case ClientMessageType.Open:
      if (
        isMapDef(m.map) &&
        isString(m.difficulty) &&
        DIFFICULTIES.includes(m.difficulty as Difficulty) &&
        isBuilderId(m.builder) &&
        (m.previous === undefined || isPrevious(m.previous))
      ) {
        return {
          t: ClientMessageType.Open,
          map: m.map as MapDef,
          difficulty: m.difficulty as Difficulty,
          builder: m.builder,
          ...(m.previous !== undefined ? { previous: m.previous } : {}),
        };
      }
      return null;
    case ClientMessageType.Order: {
      if (!isNumber(m.tick) || !isString(m.fingerprint)) return null;
      const cmd = readCommand(m.cmd);
      if (!cmd) return null;
      return { t: ClientMessageType.Order, tick: m.tick, cmd, fingerprint: m.fingerprint };
    }
    case ClientMessageType.Check:
      if (isNumber(m.tick) && isString(m.fingerprint)) {
        return { t: ClientMessageType.Check, tick: m.tick, fingerprint: m.fingerprint };
      }
      return null;
    case ClientMessageType.Pace:
      if (isNumber(m.tick) && isBoolean(m.paused)) {
        return { t: ClientMessageType.Pace, tick: m.tick, paused: m.paused };
      }
      return null;
    case ClientMessageType.Resumable:
      if (isString(m.id) && isString(m.token)) {
        return { t: ClientMessageType.Resumable, id: m.id, token: m.token };
      }
      return null;
    case ClientMessageType.Resume:
      if (isString(m.id) && isString(m.token)) {
        return { t: ClientMessageType.Resume, id: m.id, token: m.token };
      }
      return null;
    case ClientMessageType.Host:
      if (
        isString(m.nick) &&
        isMapDef(m.map) &&
        isString(m.difficulty) &&
        DIFFICULTIES.includes(m.difficulty as Difficulty) &&
        (m.mode === undefined || m.mode === Mode.Duel || m.mode === Mode.Coop || m.mode === Mode.Teams)
      ) {
        return {
          t: ClientMessageType.Host,
          nick: m.nick,
          map: m.map as MapDef,
          difficulty: m.difficulty as Difficulty,
          mode: m.mode ?? Mode.Duel,
        };
      }
      return null;
    case ClientMessageType.Join:
      if (isString(m.nick) && isString(m.code) && CODE_PATTERN.test(m.code) && m.map === undefined && m.difficulty === undefined) {
        return { t: ClientMessageType.Join, nick: m.nick, code: m.code };
      }
      return null;
    case ClientMessageType.Leave:
      return { t: ClientMessageType.Leave };
    case ClientMessageType.Start:
      return { t: ClientMessageType.Start };
    case ClientMessageType.Rejoin:
      if (isString(m.code) && CODE_PATTERN.test(m.code) && isString(m.token) && m.token !== '') {
        return { t: ClientMessageType.Rejoin, code: m.code, token: m.token };
      }
      return null;
    case ClientMessageType.ChooseBuilder:
      if (isBuilderId(m.builder)) {
        return { t: ClientMessageType.ChooseBuilder, builder: m.builder };
      }
      return null;
    case ClientMessageType.ChooseTeam:
      if (m.team === Team.A || m.team === Team.B) {
        return { t: ClientMessageType.ChooseTeam, team: m.team };
      }
      return null;
    case ClientMessageType.ChooseMap:
      if (isMapDef(m.map)) {
        return { t: ClientMessageType.ChooseMap, map: m.map };
      }
      return null;
    default:
      return null;
  }
}

export interface OtherMap { seat: number; nick: string; snapshot: WorldSnapshot }

export type ServerMessage =
  | { t: ServerMessageType.Opened; id: string; token: string; snapshot: WorldSnapshot }
  | { t: ServerMessageType.Drift; snapshot: WorldSnapshot }
  | { t: ServerMessageType.Over; verdict: Verdict; snapshot: WorldSnapshot }
  | { t: ServerMessageType.Resumed; snapshot: WorldSnapshot; paused: boolean }
  | { t: ServerMessageType.Resumable; ok: boolean }
  | { t: ServerMessageType.Ended }
  | { t: ServerMessageType.Hosted; code: string; host: string; map: MapDef; difficulty: Difficulty; mode: Mode }
  | { t: ServerMessageType.Room; host: string; guest: string | null; map: MapDef; difficulty: Difficulty; mode: Mode; picked: { host: boolean; guest: boolean } }
  | { t: ServerMessageType.TeamRoom; host: string; map: MapDef; difficulty: Difficulty; teams: Record<Team, { nick: string; picked: boolean }[]>; waiting: string[] }
  | { t: ServerMessageType.Refused; reason: string }
  | { t: ServerMessageType.Cancelled }
  | {
      t: ServerMessageType.DuelStarted;
      code: string;
      seat: Seat;
      token: string;
      snapshot: WorldSnapshot;
      others: OtherMap[];
    }
  | { t: ServerMessageType.DuelOver; verdict: Verdict; snapshot: WorldSnapshot; others: OtherMap[] }
  | { t: ServerMessageType.Rival; seat: number; nick: string; snapshot: WorldSnapshot }
  | { t: ServerMessageType.Frozen; remainingMs: number }
  | { t: ServerMessageType.Thawed; seat: Seat; snapshot: WorldSnapshot; others: OtherMap[] };
