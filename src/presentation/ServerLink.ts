import type { ClientMessage, ServerMessage } from '../application/online/protocol';

/** Liaison au serveur de partie : transport WebSocket, aucune logique de jeu. */
export class ServerLink {
  private ws: WebSocket | null = null;
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  private lostHandler: (() => void) | null = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/partie`);
      this.ws = ws;
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error('connexion refusée')), { once: true });
      ws.addEventListener('message', (e) => {
        this.messageHandler?.(JSON.parse(e.data as string) as ServerMessage);
      });
      ws.addEventListener('close', () => this.lostHandler?.());
    });
  }

  send(msg: ClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }

  onMessage(fn: (msg: ServerMessage) => void): void {
    this.messageHandler = fn;
  }

  onLost(fn: () => void): void {
    this.lostHandler = fn;
  }

  /** Ferme la liaison volontairement : plus aucun gestionnaire ne se déclenchera ensuite. */
  close(): void {
    this.messageHandler = null;
    this.lostHandler = null;
    this.ws?.close();
  }
}
