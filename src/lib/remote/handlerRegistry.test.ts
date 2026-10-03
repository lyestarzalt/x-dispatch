import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type RemoteSender,
  broadcast,
  handle,
  invokeRemote,
  resetRegistryForTests,
  setRemoteBroadcaster,
} from './handlerRegistry';

const { ipcMain, windows } = vi.hoisted(() => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  windows: [] as { isDestroyed: () => boolean; webContents: { send: ReturnType<typeof vi.fn> } }[],
}));
vi.mock('electron', () => ({
  ipcMain,
  BrowserWindow: { getAllWindows: () => windows },
}));
vi.mock('@/lib/bridge/channelPolicy', () => ({
  isRemoteAllowed: (channel: string) => channel !== 'debug:dbExec',
}));

function sender(): RemoteSender {
  return { id: 'remote:1', send: vi.fn(), isDestroyed: () => false };
}

beforeEach(() => {
  resetRegistryForTests();
  windows.length = 0;
  ipcMain.handle.mockClear();
});

describe('handle', () => {
  it('registers with ipcMain and serves remote calls with a remote event', async () => {
    const fn = vi.fn(async (_e: unknown, a: number, b: number) => a + b);
    handle('math:add', fn);
    expect(ipcMain.handle).toHaveBeenCalledWith('math:add', fn);
    const s = sender();
    const result = await invokeRemote(s, 'math:add', [2, 3]);
    expect(result).toEqual({ ok: true, value: 5 });
    expect(fn.mock.calls[0]?.[0]).toMatchObject({ sender: s });
  });

  it('rejects desktop-only and unknown channels without calling a handler', async () => {
    const fn = vi.fn();
    handle('debug:dbExec', fn);
    expect(await invokeRemote(sender(), 'debug:dbExec', [])).toEqual({
      ok: false,
      error: { code: 'desktop-only', message: expect.any(String) },
    });
    expect(await invokeRemote(sender(), 'nope', [])).toEqual({
      ok: false,
      error: { code: 'unknown-channel', message: expect.any(String) },
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('reports a throwing handler as handler-error', async () => {
    handle('boom', async () => {
      throw new Error('bad');
    });
    expect(await invokeRemote(sender(), 'boom', [])).toEqual({
      ok: false,
      error: { code: 'handler-error', message: 'bad' },
    });
  });
});

describe('broadcast', () => {
  it('reaches live windows and the remote broadcaster', () => {
    const live = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    const dead = { isDestroyed: () => true, webContents: { send: vi.fn() } };
    windows.push(live, dead);
    const remote = vi.fn();
    setRemoteBroadcaster(remote);
    broadcast('airports-updated', { n: 1 });
    expect(live.webContents.send).toHaveBeenCalledWith('airports-updated', { n: 1 });
    expect(dead.webContents.send).not.toHaveBeenCalled();
    expect(remote).toHaveBeenCalledWith('airports-updated', { n: 1 });
  });
});
