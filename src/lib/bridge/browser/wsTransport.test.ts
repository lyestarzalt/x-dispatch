import { describe, expect, it, vi } from 'vitest';
import { WsTransport } from './wsTransport';

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

function make() {
  FakeSocket.instances.length = 0;
  const onState = vi.fn();
  const transport = new WsTransport({
    url: 'ws://host/ws',
    createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    onStateChange: onState,
    reconnectDelayMs: () => 0,
  });
  transport.connect();
  return { transport, socket: () => FakeSocket.instances.at(-1)!, onState };
}

describe('WsTransport', () => {
  it('queues requests until the socket opens and resolves them by id', async () => {
    const { transport, socket } = make();
    const pending = transport.invoke('get-airports', 'x');
    expect(socket().sent).toHaveLength(0);
    socket().open();
    expect(JSON.parse(socket().sent[0] ?? '')).toEqual({
      t: 'req',
      id: 1,
      ch: 'get-airports',
      args: ['x'],
    });
    socket().receive({ t: 'res', id: 1, ok: true, value: [1, 2] });
    await expect(pending).resolves.toEqual([1, 2]);
  });

  it('rejects a request with the error code the server sent', async () => {
    const { transport, socket } = make();
    socket().open();
    const pending = transport.invoke('debug:dbExec');
    socket().receive({
      t: 'res',
      id: 1,
      ok: false,
      error: { code: 'desktop-only', message: 'no' },
    });
    await expect(pending).rejects.toMatchObject({ code: 'desktop-only' });
  });

  it('dispatches pushed events to subscribers until they unsubscribe', () => {
    const { transport, socket } = make();
    socket().open();
    const cb = vi.fn();
    const off = transport.on('flights:event', cb);
    socket().receive({ t: 'ev', ch: 'flights:event', args: [{ kind: 'start' }] });
    expect(cb).toHaveBeenCalledWith({ kind: 'start' });
    off();
    socket().receive({ t: 'ev', ch: 'flights:event', args: [{ kind: 'end' }] });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('reconnects after an ordinary close and fails pending calls', async () => {
    const { transport, socket, onState } = make();
    const first = socket();
    first.open();
    const pending = transport.invoke('get-airports');
    first.onclose?.({ code: 1006 });
    await expect(pending).rejects.toMatchObject({ code: 'disconnected' });
    expect(onState).toHaveBeenLastCalledWith('reconnecting');
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
  });

  it('stops for good when the pairing was reset', () => {
    const { socket, onState } = make();
    socket().open();
    socket().onclose?.({ code: 4401 });
    expect(onState).toHaveBeenLastCalledWith('pairing-reset');
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
