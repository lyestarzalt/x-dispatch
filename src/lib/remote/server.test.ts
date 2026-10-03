import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { handle, resetRegistryForTests } from './handlerRegistry';
import { CLOSE_UNAUTHORIZED, type ServerFrame } from './protocol';
import { RemoteServer } from './server';

const { ipcMain } = vi.hoisted(() => ({ ipcMain: { handle: vi.fn(), on: vi.fn() } }));
vi.mock('electron', () => ({ ipcMain, BrowserWindow: { getAllWindows: () => [] } }));
vi.mock('@/lib/bridge/channelPolicy', () => ({
  isRemoteAllowed: (channel: string) => channel !== 'debug:dbExec',
}));

const TOKEN = 'a'.repeat(32);
let server: RemoteServer;
let base: string;
let disconnected: string[];

async function get(path: string, headers: Record<string, string> = {}) {
  return fetch(base + path, { headers, redirect: 'manual' });
}

function openSocket(headers: Record<string, string>) {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws', { headers });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
    ws.once('unexpected-response', (_req, res) => reject(new Error(String(res.statusCode))));
  });
}

function nextFrame(ws: WebSocket) {
  return new Promise<ServerFrame>((resolve) =>
    ws.once('message', (data) => resolve(JSON.parse(data.toString())))
  );
}

beforeEach(async () => {
  resetRegistryForTests();
  disconnected = [];
  server = new RemoteServer({
    getToken: () => TOKEN,
    servePage: (_req, res) => res.writeHead(200, { 'Content-Type': 'text/plain' }).end('page'),
    fetchTile: async (url) => ({
      status: 200,
      contentType: 'image/webp',
      body: new TextEncoder().encode(url),
      cacheHit: true,
    }),
    onClientDisconnected: (id) => disconnected.push(id),
    log: { info: () => undefined, warn: () => undefined },
  });
  const port = await server.start(0, '127.0.0.1');
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await server.stop();
});

describe('RemoteServer http', () => {
  it('refuses requests without the token', async () => {
    expect((await get('/')).status).toBe(401);
  });

  it('sets the pairing cookie on a tokenised page request and then serves by cookie', async () => {
    const first = await get(`/?token=${TOKEN}`);
    expect(first.status).toBe(200);
    const cookie = first.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`xd_remote=${TOKEN}`);
    expect(cookie).toContain('HttpOnly');
    const second = await get('/assets/app.js', { cookie: `xd_remote=${TOKEN}` });
    expect(second.status).toBe(200);
    expect(await second.text()).toBe('page');
  });

  it('serves cached tiles under /tile-cache/', async () => {
    const res = await get('/tile-cache/tiles.example.com/1/2/3.webp', {
      cookie: `xd_remote=${TOKEN}`,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(await res.text()).toBe('https://tiles.example.com/1/2/3.webp');
  });

  it('rate-limits an address after repeated bad tokens', async () => {
    for (let i = 0; i < 10; i++) await get('/?token=wrong');
    expect((await get(`/?token=${TOKEN}`)).status).toBe(429);
  });
});

describe('RemoteServer websocket', () => {
  it('rejects the upgrade without the cookie', async () => {
    await expect(openSocket({})).rejects.toThrow('401');
  });

  it('rejects the upgrade from a foreign origin', async () => {
    await expect(
      openSocket({ cookie: `xd_remote=${TOKEN}`, origin: 'http://evil.example' })
    ).rejects.toThrow('403');
  });

  it('answers requests through the handler registry and pushes to the caller', async () => {
    handle('echo', async (event, value: string) => {
      event.sender.send('echo:event', value.toUpperCase());
      return `echo ${value}`;
    });
    const ws = await openSocket({ cookie: `xd_remote=${TOKEN}` });
    const events: ServerFrame[] = [];
    ws.on('message', (d) => events.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ t: 'req', id: 1, ch: 'echo', args: ['hi'] }));
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events).toContainEqual({ t: 'ev', ch: 'echo:event', args: ['HI'] });
    expect(events).toContainEqual({ t: 'res', id: 1, ok: true, value: 'echo hi' });
    expect(server.clients()).toHaveLength(1);
    ws.close();
    await vi.waitFor(() => expect(disconnected).toHaveLength(1));
    expect(server.clients()).toHaveLength(0);
  });

  it('returns desktop-only for a refused channel and broadcasts to every tablet', async () => {
    handle('debug:dbExec', async () => 'never');
    const ws = await openSocket({ cookie: `xd_remote=${TOKEN}` });
    const reply = nextFrame(ws);
    ws.send(JSON.stringify({ t: 'req', id: 7, ch: 'debug:dbExec', args: [] }));
    expect(await reply).toMatchObject({ id: 7, ok: false, error: { code: 'desktop-only' } });
    const pushed = nextFrame(ws);
    server.broadcast('airports-updated', 1);
    expect(await pushed).toEqual({ t: 'ev', ch: 'airports-updated', args: [1] });
    ws.close();
  });

  it('disconnectAll closes every socket with the unauthorized code', async () => {
    const ws = await openSocket({ cookie: `xd_remote=${TOKEN}` });
    const closed = new Promise<number>((resolve) => ws.once('close', resolve));
    server.disconnectAll();
    expect(await closed).toBe(CLOSE_UNAUTHORIZED);
  });
});
