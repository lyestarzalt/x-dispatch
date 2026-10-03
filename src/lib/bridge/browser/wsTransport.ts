/**
 * window.*API transport for a browser on another device: one WebSocket to the
 * desktop app carrying request/response frames and pushed events.
 */
import { CLOSE_UNAUTHORIZED, type ClientFrame, type ServerFrame } from '@/lib/remote/protocol';
import type { BridgeTransport } from '../apiSurface';

export type RemoteConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'pairing-reset';

export class RemoteCallError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'RemoteCallError';
  }
}

export interface WsTransportOptions {
  url: string;
  createSocket?: (url: string) => WebSocket;
  onStateChange?: (state: RemoteConnectionState) => void;
  reconnectDelayMs?: (attempt: number) => number;
}

const defaultDelay = (attempt: number) => Math.min(10_000, 500 * 2 ** attempt);

export class WsTransport implements BridgeTransport {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private queue: string[] = [];
  private listeners = new Map<string, Set<(payload: never) => void>>();
  private attempt = 0;
  private stopped = false;

  constructor(private opts: WsTransportOptions) {}

  connect(): void {
    if (this.stopped) return;
    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const create = this.opts.createSocket ?? ((url: string) => new WebSocket(url));
    const ws = create(this.opts.url);
    this.socket = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.setState('connected');
      for (const data of this.queue) ws.send(data);
      this.queue = [];
    };
    ws.onmessage = (ev) => this.handleFrame(JSON.parse(String(ev.data)) as ServerFrame);
    ws.onclose = (ev) => {
      this.socket = null;
      this.failPending();
      if (ev.code === CLOSE_UNAUTHORIZED) {
        this.stopped = true;
        this.setState('pairing-reset');
        return;
      }
      this.setState('reconnecting');
      const delay = (this.opts.reconnectDelayMs ?? defaultDelay)(this.attempt++);
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => undefined;
  }

  invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
    const id = this.nextId++;
    const frame: ClientFrame = { t: 'req', id, ch: channel, args };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write(JSON.stringify(frame));
    });
  };

  send = (channel: string, ...args: unknown[]): void => {
    const frame: ClientFrame = { t: 'send', ch: channel, args };
    this.write(JSON.stringify(frame));
  };

  on = <T>(channel: string, listener: (payload: T) => void): (() => void) => {
    const set = this.listeners.get(channel) ?? new Set();
    set.add(listener as (payload: never) => void);
    this.listeners.set(channel, set);
    return () => {
      set.delete(listener as (payload: never) => void);
    };
  };

  private write(data: string): void {
    if (this.socket && this.socket.readyState === 1) this.socket.send(data);
    else this.queue.push(data);
  }

  private handleFrame(frame: ServerFrame): void {
    if (frame.t === 'res') {
      const entry = this.pending.get(frame.id);
      if (!entry) return;
      this.pending.delete(frame.id);
      if (frame.ok) entry.resolve(frame.value);
      else entry.reject(new RemoteCallError(frame.error.code, frame.error.message));
    } else if (frame.t === 'ev') {
      this.listeners.get(frame.ch)?.forEach((l) => l(frame.args[0] as never));
    }
  }

  private failPending(): void {
    for (const entry of this.pending.values()) {
      entry.reject(new RemoteCallError('disconnected', 'Connection to X-Dispatch lost'));
    }
    this.pending.clear();
    this.queue = [];
  }

  private setState(state: RemoteConnectionState): void {
    this.opts.onStateChange?.(state);
  }
}
