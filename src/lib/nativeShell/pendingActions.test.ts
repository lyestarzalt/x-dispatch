import { describe, expect, it } from 'vitest';
import { createPendingActions } from './pendingActions';

describe('createPendingActions', () => {
  it('starts not ready and holds pushes until drained', () => {
    const q = createPendingActions<string>();
    expect(q.isReady()).toBe(false);
    q.push('a');
    q.push('b');
    expect(q.isReady()).toBe(false);
    expect(q.drain()).toEqual(['a', 'b']);
    expect(q.isReady()).toBe(true);
  });

  it('drains to empty after a hand-over', () => {
    const q = createPendingActions<string>();
    q.push('a');
    q.drain();
    expect(q.drain()).toEqual([]);
  });

  it('goes back to holding after a reset, keeping anything pushed meanwhile', () => {
    const q = createPendingActions<string>();
    q.drain();
    q.reset();
    expect(q.isReady()).toBe(false);
    q.push('after-reload');
    expect(q.drain()).toEqual(['after-reload']);
  });
});
