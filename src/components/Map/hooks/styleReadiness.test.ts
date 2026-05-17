import { describe, expect, it, vi } from 'vitest';
import { runWhenStyleIsReady } from './styleReadiness';

class MockStyleMap {
  loaded = false;
  style: { _loaded: boolean } | undefined;
  listeners = new Map<string, Set<() => void>>();

  isStyleLoaded() {
    return this.loaded;
  }

  once(event: string, listener: () => void) {
    const listeners = this.listeners.get(event) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  off(event: string, listener: () => void) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string) {
    const listeners = [...(this.listeners.get(event) ?? [])];
    this.listeners.set(event, new Set());
    for (const listener of listeners) listener();
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  }
}

describe('runWhenStyleIsReady', () => {
  it('runs when the style object is loaded even if the map is still dirty', () => {
    const map = new MockStyleMap();
    const run = vi.fn();
    map.style = { _loaded: true };

    runWhenStyleIsReady(map, run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(map.listenerCount('styledata')).toBe(0);
  });

  it('retries on styledata until the map style is loaded', () => {
    const map = new MockStyleMap();
    const run = vi.fn();

    runWhenStyleIsReady(map, run);

    expect(run).not.toHaveBeenCalled();
    expect(map.listenerCount('styledata')).toBe(1);
    expect(map.listenerCount('style.load')).toBe(0);

    map.emit('styledata');

    expect(run).not.toHaveBeenCalled();
    expect(map.listenerCount('styledata')).toBe(1);

    map.loaded = true;
    map.emit('styledata');

    expect(run).toHaveBeenCalledTimes(1);
    expect(map.listenerCount('styledata')).toBe(0);
  });

  it('removes a pending styledata listener on cleanup', () => {
    const map = new MockStyleMap();
    const run = vi.fn();

    const cleanup = runWhenStyleIsReady(map, run);
    cleanup();

    map.loaded = true;
    map.emit('styledata');

    expect(run).not.toHaveBeenCalled();
    expect(map.listenerCount('styledata')).toBe(0);
  });
});
