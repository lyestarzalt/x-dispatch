import { beforeEach, describe, expect, it, vi } from 'vitest';
import { XPlaneService } from './service';

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  setTrafficEnabled: vi.fn(),
  isConnected: vi.fn(() => false),
  setSink: vi.fn(),
  forceReconnect: vi.fn(),
}));
vi.mock('./websocketClient', () => ({
  XPlaneWebSocketClient: vi.fn(function () {
    return client;
  }),
}));
vi.mock('./restClient', () => ({ getRestClient: vi.fn() }));
vi.mock('./processCheck', () => ({ isXPlaneProcessRunning: vi.fn() }));

type Callbacks = Parameters<XPlaneService['startStateStream']>[1];
const subscriber = (): Callbacks => ({
  onUpdate: vi.fn(),
  onConnectionChange: vi.fn(),
  onStateClear: vi.fn(),
});

beforeEach(() => {
  Object.values(client).forEach((fn) => fn.mockClear());
  client.isConnected.mockReturnValue(false);
});

describe('XPlaneService stream fan-out', () => {
  it('opens one upstream connection and fans updates out to every subscriber', () => {
    const service = new XPlaneService();
    const a = subscriber();
    const b = subscriber();
    service.startStateStream('a', a);
    service.startStateStream('b', b);
    expect(client.connect).toHaveBeenCalledTimes(1);
    const [onUpdate, onConnectionChange] = client.connect.mock.calls[0] as [
      (s: unknown) => void,
      (c: boolean) => void,
    ];
    onUpdate({ lat: 1 });
    onConnectionChange(true);
    expect(a.onUpdate).toHaveBeenCalledWith({ lat: 1 });
    expect(b.onUpdate).toHaveBeenCalledWith({ lat: 1 });
    expect(b.onConnectionChange).toHaveBeenCalledWith(true);
  });

  it('tells a late subscriber the current connection state', () => {
    const service = new XPlaneService();
    service.startStateStream('a', subscriber());
    client.isConnected.mockReturnValue(true);
    const late = subscriber();
    service.startStateStream('late', late);
    expect(late.onConnectionChange).toHaveBeenCalledWith(true);
  });

  it('closes upstream only when the last subscriber leaves', () => {
    const service = new XPlaneService();
    service.startStateStream('a', subscriber());
    service.startStateStream('b', subscriber());
    service.stopStateStream('a');
    expect(client.disconnect).not.toHaveBeenCalled();
    service.stopStateStream('b');
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps traffic on while any subscriber wants it and fans snapshots out', () => {
    const service = new XPlaneService();
    const onA = vi.fn();
    const onB = vi.fn();
    service.setTrafficEnabled('a', true, onA);
    service.setTrafficEnabled('b', true, onB);
    expect(client.setTrafficEnabled).toHaveBeenLastCalledWith(true, expect.any(Function));
    const fan = client.setTrafficEnabled.mock.calls.at(-1)?.[1] as (s: unknown) => void;
    fan({ targets: [] });
    expect(onA).toHaveBeenCalledWith({ targets: [] });
    expect(onB).toHaveBeenCalledWith({ targets: [] });
    service.setTrafficEnabled('a', false, null);
    expect(client.setTrafficEnabled).toHaveBeenLastCalledWith(true, expect.any(Function));
    service.setTrafficEnabled('b', false, null);
    expect(client.setTrafficEnabled).toHaveBeenLastCalledWith(false, null);
  });

  it('drops a subscriber from both streams at once', () => {
    const service = new XPlaneService();
    service.startStateStream('a', subscriber());
    service.setTrafficEnabled('a', true, vi.fn());
    service.unsubscribe('a');
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.setTrafficEnabled).toHaveBeenLastCalledWith(false, null);
  });
});
