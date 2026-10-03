import { describe, expect, it, vi } from 'vitest';
import {
  type BridgeExtras,
  type BridgeTransport,
  buildBridgeApis,
  collectChannels,
} from './apiSurface';

function fakeTransport() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const transport: BridgeTransport = {
    invoke: vi.fn(async (channel: string) => `result:${channel}`),
    send: vi.fn(),
    on: vi.fn((channel: string, listener: (payload: never) => void) => {
      const set = listeners.get(channel) ?? new Set();
      set.add(listener as (payload: unknown) => void);
      listeners.set(channel, set);
      return () => {
        set.delete(listener as (payload: unknown) => void);
      };
    }) as BridgeTransport['on'],
  };
  const emit = (channel: string, payload: unknown) =>
    listeners.get(channel)?.forEach((l) => l(payload));
  return { transport, emit, listeners };
}

const extras: BridgeExtras = {
  platform: 'linux',
  isRemoteClient: true,
  setZoomFactor: () => undefined,
  getZoomFactor: () => 1,
  getFilePathForDrop: () => '',
  versions: { node: () => 'n', chrome: () => 'c', electron: () => 'e' },
};

describe('buildBridgeApis', () => {
  it('routes request/response methods through transport.invoke with the arguments', async () => {
    const { transport } = fakeTransport();
    const apis = buildBridgeApis(transport, extras);
    const result = await apis.airportAPI.getAirportData('EGLL');
    expect(transport.invoke).toHaveBeenCalledWith('get-airport-data', 'EGLL');
    expect(result).toBe('result:get-airport-data');
  });

  it('routes fire-and-forget methods through transport.send', () => {
    const { transport } = fakeTransport();
    const apis = buildBridgeApis(transport, extras);
    apis.appAPI.log.warn('msg', 1, 'two');
    expect(transport.send).toHaveBeenCalledWith('log:warn', 'msg', [1, 'two']);
  });

  it('subscribes to pushes through transport.on and unsubscribes with the returned function', () => {
    const { transport, emit, listeners } = fakeTransport();
    const apis = buildBridgeApis(transport, extras);
    const cb = vi.fn();
    const unsubscribe = apis.xplaneServiceAPI.onStateUpdate(cb);
    emit('xplaneService:stateUpdate', { lat: 1 });
    expect(cb).toHaveBeenCalledWith({ lat: 1 });
    unsubscribe();
    expect(listeners.get('xplaneService:stateUpdate')?.size).toBe(0);
  });

  it('defaults the command duration to 0', async () => {
    const { transport } = fakeTransport();
    const apis = buildBridgeApis(transport, extras);
    await apis.xplaneServiceAPI.activateCommand('sim/x');
    expect(transport.invoke).toHaveBeenCalledWith('xplaneService:activateCommand', 'sim/x', 0);
  });

  it('takes the non-IPC members from the extras', () => {
    const { transport } = fakeTransport();
    const apis = buildBridgeApis(transport, extras);
    expect(apis.appAPI.platform).toBe('linux');
    expect(apis.appAPI.isRemoteClient).toBe(true);
    expect(apis.versions.electron()).toBe('e');
  });
});

describe('collectChannels', () => {
  it('lists every invoke, send and push channel in disjoint groups', () => {
    const channels = collectChannels();
    expect(channels.invoke).toContain('get-airports');
    expect(channels.invoke).toContain('debug:dbExec');
    expect(channels.send).toContain('analytics:track');
    expect(channels.push).toContain('xplaneService:trafficUpdate');
    expect(channels.push).toContain('flights:event');
    const all = [...channels.invoke, ...channels.send, ...channels.push];
    expect(new Set(all).size).toBe(all.length);
    expect(channels.invoke.length).toBeGreaterThan(100);
  });
});
