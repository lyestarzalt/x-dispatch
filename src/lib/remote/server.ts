/**
 * The LAN server behind "Tablet access": serves the renderer bundle, the tile
 * cache and one WebSocket per device that carries the window.*API calls.
 */
import { randomUUID } from 'crypto';
import * as http from 'http';
import type { Duplex } from 'stream';
import { type WebSocket, WebSocketServer } from 'ws';
import type { TileResponse } from '@/lib/tileCache/fetchTile';
import { RemoteAuth } from './auth';
import { type RemoteSender, invokeRemote, sendRemote } from './handlerRegistry';
import {
  CLOSE_UNAUTHORIZED,
  type ClientFrame,
  type ServerFrame,
  TILE_PATH_PREFIX,
  WS_PATH,
} from './protocol';
import type { RouteHandler } from './staticRoute';
import type { RemoteClientInfo } from './types';

export interface RemoteServerOptions {
  getToken: () => string;
  /** Serves the page and its assets (built bundle, or the Vite dev proxy). */
  servePage: RouteHandler;
  fetchTile: (httpsUrl: string) => Promise<TileResponse>;
  onClientsChanged?: (clients: RemoteClientInfo[]) => void;
  onClientConnected?: (clients: RemoteClientInfo[]) => void;
  onClientDisconnected?: (clientId: string) => void;
  log: { info: (msg: string) => void; warn: (msg: string) => void };
}

interface Client extends RemoteClientInfo {
  socket: WebSocket;
}

export class RemoteServer {
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private auth: RemoteAuth;
  private clientMap = new Map<string, Client>();

  constructor(private opts: RemoteServerOptions) {
    this.auth = new RemoteAuth(opts.getToken);
  }

  /** Resolves with the bound port. */
  start(port: number, host = '0.0.0.0'): Promise<number> {
    const server = http.createServer((req, res) => this.handleHttp(req, res));
    const wss = new WebSocketServer({ noServer: true, perMessageDeflate: true });
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(wss, req, socket, head));
    this.httpServer = server;
    this.wss = wss;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        const bound = (server.address() as { port: number }).port;
        this.opts.log.info(`Tablet access server listening on ${host}:${bound}`);
        resolve(bound);
      });
    });
  }

  async stop(): Promise<void> {
    this.disconnectAll();
    this.wss?.close();
    this.wss = null;
    const server = this.httpServer;
    this.httpServer = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  }

  isRunning(): boolean {
    return this.httpServer !== null;
  }

  clients(): RemoteClientInfo[] {
    return [...this.clientMap.values()].map(({ id, ip, userAgent, connectedAt }) => ({
      id,
      ip,
      userAgent,
      connectedAt,
    }));
  }

  /** Used by "Reset pairing" and on stop: every device has to scan again. */
  disconnectAll(): void {
    for (const client of this.clientMap.values()) {
      client.socket.close(CLOSE_UNAUTHORIZED, 'pairing reset');
    }
  }

  broadcast(channel: string, ...args: unknown[]): void {
    const frame: ServerFrame = { t: 'ev', ch: channel, args };
    const data = JSON.stringify(frame);
    for (const client of this.clientMap.values()) {
      if (client.socket.readyState === client.socket.OPEN) client.socket.send(data);
    }
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
    const outcome = this.auth.check(req);
    if (outcome !== 'ok') {
      this.opts.log.warn(
        `Tablet access: ${outcome} request from ${req.socket.remoteAddress} for ${req.url}`
      );
      res.writeHead(outcome === 'rate-limited' ? 429 : 401, { 'Content-Type': 'text/plain' });
      res.end(outcome === 'rate-limited' ? 'Too many attempts' : 'Scan the QR code in X-Dispatch');
      return;
    }
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.searchParams.has('token')) {
      res.setHeader('Set-Cookie', this.auth.cookieHeader());
    }
    if (url.pathname.startsWith(TILE_PATH_PREFIX)) {
      void this.serveTile(url.pathname.slice(TILE_PATH_PREFIX.length), res);
      return;
    }
    this.opts.servePage(req, res);
  }

  private async serveTile(hostAndPath: string, res: http.ServerResponse): Promise<void> {
    const tile = await this.opts.fetchTile(`https://${hostAndPath}`);
    if (!tile.body) {
      res.writeHead(tile.status || 502).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': tile.contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Tile-Cache': tile.cacheHit ? 'HIT' : 'MISS',
    });
    res.end(Buffer.from(tile.body));
  }

  private handleUpgrade(
    wss: WebSocketServer,
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void {
    const reject = (status: number, text: string) => {
      this.opts.log.warn(
        `Tablet access: upgrade refused (${status}) from ${req.socket.remoteAddress}`
      );
      socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname !== WS_PATH) return reject(404, 'Not Found');
    if (this.auth.check(req) !== 'ok') return reject(401, 'Unauthorized');
    const origin = req.headers.origin;
    if (origin) {
      let originHost: string | null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (originHost !== req.headers.host) return reject(403, 'Forbidden');
    }
    wss.handleUpgrade(req, socket, head, (ws) => this.attach(ws, req));
  }

  private attach(ws: WebSocket, req: http.IncomingMessage): void {
    const client: Client = {
      id: `remote:${randomUUID()}`,
      ip: req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? '',
      connectedAt: new Date().toISOString(),
      socket: ws,
    };
    this.clientMap.set(client.id, client);
    this.opts.log.info(`Tablet connected: ${client.ip} (${client.userAgent})`);
    this.opts.onClientConnected?.(this.clients());
    this.opts.onClientsChanged?.(this.clients());

    const push = (frame: ServerFrame) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
    };
    const sender: RemoteSender = {
      id: client.id,
      send: (channel, ...args) => push({ t: 'ev', ch: channel, args }),
      isDestroyed: () => ws.readyState !== ws.OPEN,
    };

    ws.on('message', (data) => {
      let frame: ClientFrame;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (frame.t === 'req') {
        void invokeRemote(sender, frame.ch, frame.args ?? []).then((result) =>
          push({ t: 'res', id: frame.id, ...result } as ServerFrame)
        );
      } else if (frame.t === 'send') {
        sendRemote(sender, frame.ch, frame.args ?? []);
      }
    });
    ws.on('close', () => {
      this.clientMap.delete(client.id);
      this.opts.log.info(`Tablet disconnected: ${client.ip}`);
      this.opts.onClientDisconnected?.(client.id);
      this.opts.onClientsChanged?.(this.clients());
    });
    ws.on('error', (err) => this.opts.log.warn(`Tablet socket error: ${err.message}`));
  }
}
