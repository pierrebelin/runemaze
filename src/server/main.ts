import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { Referee } from '../application/online/referee';
import { ClientMessageType, readClientMessage, ServerMessageType } from '../application/online/protocol';
import type { ServerMessage } from '../application/online/protocol';
import { duelCode, Lobby, type Addressed } from '../application/online/lobby';
import type { Seat } from '../application/online/duel';

/** Aucune logique de jeu ici : lit le message, appelle l'arbitre, renvoie le `ServerMessage`. */

const PORT = Number(process.env.PORT) || 8080;
/** Adresse d'écoute ; `127.0.0.1` en production derrière Nginx, toutes les interfaces sinon. */
const HOST = process.env.HOST;
const DIST_DIR = join(fileURLToPath(import.meta.url), '../../../dist');
const ADVANCE_INTERVAL_MS = 50;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const referee = new Referee();
/** Partie tenue par la socket, pour relayer `order`/`check`/`pace` sans identifiant explicite. */
const sockets = new Map<WebSocket, { id: string; token: string }>();

const lobby = new Lobby();
/** Identifiant de connexion pour le salon, distinct de l'`id` de partie. */
const socketByKey = new Map<string, WebSocket>();
const keyBySocket = new Map<WebSocket, string>();
/** Siège d'un duel tenu par la socket, une fois la partie à deux lancée. */
const duelSeats = new Map<WebSocket, { code: string; seat: Seat }>();

function seed(): number {
  return randomBytes(4).readUInt32BE(0);
}

function drawToken(): string {
  return randomBytes(16).toString('hex');
}

/** Tire un code de salon libre à partir de 6 entiers aléatoires. */
function drawCode(): string {
  let code: string;
  do {
    code = duelCode(Array.from(randomBytes(6)));
  } while (lobby.taken(code));
  return code;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function dispatchAddressed(addressed: Addressed[]): void {
  for (const a of addressed) {
    const target = socketByKey.get(a.key);
    if (target) send(target, a.msg);
  }
}

/** Envoie chaque `SeatMessage` à la socket qui tient le siège visé dans ce salon. */
function dispatchSeated(code: string, messages: { seat: Seat; msg: ServerMessage }[]): void {
  for (const sm of messages) {
    for (const [target, other] of duelSeats) {
      if (other.code === code && other.seat === sm.seat) send(target, sm.msg);
    }
  }
}

/** Fait tenir `id`/`token` par la socket ; abandonne l'ancienne partie tenue si elle diffère. */
function hold(ws: WebSocket, id: string, token: string, now: number): void {
  const previous = sockets.get(ws);
  if (previous && previous.id !== id) referee.lose(previous.id, now);
  sockets.set(ws, { id, token });
}

const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname;
  const path = pathname === '/' ? '/index.html' : pathname;
  const resolved = resolve(join(DIST_DIR, path));
  // Refuse tout chemin qui sortirait de dist/ (ex. `..`).
  if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + sep)) {
    res.writeHead(404);
    res.end();
    return;
  }
  readFile(resolved)
    .then((data) => {
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404);
      res.end();
    });
});

const wss = new WebSocketServer({ server: httpServer, path: '/partie' });

wss.on('connection', (ws) => {
  const key = randomUUID();
  socketByKey.set(key, ws);
  keyBySocket.set(ws, key);

  ws.on('message', (raw) => {
    const msg = readClientMessage(raw.toString());
    if (!msg) return;
    const now = Date.now();

    try {
      handleMessage(ws, msg, now);
    } catch {
      ws.close();
    }
  });

  ws.on('close', () => {
    const held = sockets.get(ws);
    if (held) referee.lose(held.id, Date.now());
    sockets.delete(ws);
    duelSeats.delete(ws);
    dispatchAddressed(lobby.leave(key, Date.now()));
    socketByKey.delete(key);
    keyBySocket.delete(ws);
  });
});

function handleMessage(ws: WebSocket, msg: NonNullable<ReturnType<typeof readClientMessage>>, now: number): void {
  switch (msg.t) {
    case ClientMessageType.Open: {
      const id = randomUUID();
      const token = randomUUID();
      hold(ws, id, token, now);
      send(
        ws,
        referee.open(
          { map: msg.map, difficulty: msg.difficulty, builder: msg.builder, seed: seed(), id, token, previous: msg.previous },
          now,
        ),
      );
      break;
    }
    case ClientMessageType.Order: {
      const seated = duelSeats.get(ws);
      if (seated) {
        const reply = lobby.duel(seated.code)?.order(seated.seat, msg, now);
        if (reply) send(ws, reply);
        break;
      }
      const held = sockets.get(ws);
      const reply = held && referee.game(held.id)?.order(msg, now);
      if (reply) send(ws, reply);
      break;
    }
    case ClientMessageType.Check: {
      const seated = duelSeats.get(ws);
      if (seated) {
        const reply = lobby.duel(seated.code)?.check(seated.seat, msg, now);
        if (reply) send(ws, reply);
        break;
      }
      const held = sockets.get(ws);
      const reply = held && referee.game(held.id)?.check(msg, now);
      if (reply) send(ws, reply);
      break;
    }
    case ClientMessageType.Pace: {
      if (duelSeats.has(ws)) break;
      const held = sockets.get(ws);
      referee.game(held?.id ?? '')?.pace(msg, now);
      break;
    }
    case ClientMessageType.Resumable: {
      send(ws, { t: ServerMessageType.Resumable, ok: referee.resumable(msg.id, msg.token, now) });
      break;
    }
    case ClientMessageType.Resume: {
      for (const [oldWs, held] of sockets) {
        if (oldWs !== ws && held.id === msg.id && held.token === msg.token) {
          referee.lose(held.id, now);
          sockets.delete(oldWs);
          oldWs.close();
        }
      }
      const reply = referee.resume(msg.id, msg.token, now);
      if (reply.t === ServerMessageType.Resumed) hold(ws, msg.id, msg.token, now);
      send(ws, reply);
      break;
    }
    case ClientMessageType.Host: {
      const key = keyBySocket.get(ws)!;
      const code = drawCode();
      dispatchAddressed(lobby.host({ code, nick: msg.nick, map: msg.map, difficulty: msg.difficulty, mode: msg.mode, key }));
      break;
    }
    case ClientMessageType.Join: {
      const key = keyBySocket.get(ws)!;
      dispatchAddressed(lobby.join({ code: msg.code, nick: msg.nick, key }));
      break;
    }
    case ClientMessageType.ChooseBuilder: {
      const key = keyBySocket.get(ws)!;
      dispatchAddressed(lobby.choose(key, msg.builder));
      break;
    }
    case ClientMessageType.Leave: {
      const key = keyBySocket.get(ws)!;
      duelSeats.delete(ws);
      dispatchAddressed(lobby.leave(key, now));
      break;
    }
    case ClientMessageType.Rejoin: {
      const key = keyBySocket.get(ws)!;
      const addressed = lobby.rejoin({ code: msg.code, token: msg.token, key }, now);
      for (const a of addressed) {
        if (a.key === key && a.msg.t === ServerMessageType.Thawed) {
          duelSeats.set(ws, { code: msg.code, seat: a.msg.seat });
        }
      }
      dispatchAddressed(addressed);
      break;
    }
    case ClientMessageType.Start: {
      const key = keyBySocket.get(ws)!;
      const addressed = lobby.start(key, seed(), [drawToken(), drawToken()], now);
      for (const a of addressed) {
        if (a.msg.t === ServerMessageType.DuelStarted) {
          const target = socketByKey.get(a.key);
          if (target) duelSeats.set(target, { code: a.msg.code, seat: a.msg.seat });
        }
      }
      dispatchAddressed(addressed);
      break;
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [ws, held] of sockets) {
    const reply = referee.game(held.id)?.advance(now);
    if (reply) send(ws, reply);
  }
  referee.sweep(now);

  const codes = new Set<string>();
  for (const seated of duelSeats.values()) codes.add(seated.code);
  for (const code of codes) {
    dispatchSeated(code, lobby.duel(code)?.advance(now) ?? []);
  }
  lobby.sweep(now);
  for (const [ws, seated] of duelSeats) {
    if (!lobby.duel(seated.code)) duelSeats.delete(ws);
  }
}, ADVANCE_INTERVAL_MS);

httpServer.listen(PORT, HOST, () => {
  console.log(`Serveur sur http://${HOST ?? 'localhost'}:${PORT}`);
});
