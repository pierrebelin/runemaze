import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { Referee } from '../application/online/referee';
import { ClientMessageType, readClientMessage, ServerMessageType } from '../application/online/protocol';
import type { ServerMessage } from '../application/online/protocol';

/** Aucune logique de jeu ici : lit le message, appelle l'arbitre, renvoie le `ServerMessage`. */

const PORT = Number(process.env.PORT) || 8080;
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

function seed(): number {
  return randomBytes(4).readUInt32BE(0);
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
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
          { map: msg.map, difficulty: msg.difficulty, seed: seed(), id, token, previous: msg.previous },
          now,
        ),
      );
      break;
    }
    case ClientMessageType.Order: {
      const held = sockets.get(ws);
      const reply = held && referee.game(held.id)?.order(msg, now);
      if (reply) send(ws, reply);
      break;
    }
    case ClientMessageType.Check: {
      const held = sockets.get(ws);
      const reply = held && referee.game(held.id)?.check(msg, now);
      if (reply) send(ws, reply);
      break;
    }
    case ClientMessageType.Pace: {
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
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [ws, held] of sockets) {
    const reply = referee.game(held.id)?.advance(now);
    if (reply) send(ws, reply);
  }
  referee.sweep(now);
}, ADVANCE_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`Serveur sur http://localhost:${PORT}`);
});
