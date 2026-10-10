/**
 * Actions that arrive before the renderer can take them.
 *
 * A deep link on a cold start fires before the window exists; on macOS
 * `open-url` can fire before `app.whenReady`. The queue holds them until the
 * renderer asks, and goes back to holding whenever the page reloads.
 */
export interface PendingActions<T> {
  /** True once the renderer has drained the queue and listens for pushes. */
  isReady(): boolean;
  /** A reload or a new window: hold actions again until the next drain. */
  reset(): void;
  /** Keep an action for the next drain. */
  push(action: T): void;
  /** Hands over everything held and marks the renderer ready. */
  drain(): T[];
}

export function createPendingActions<T>(): PendingActions<T> {
  let ready = false;
  let held: T[] = [];
  return {
    isReady: () => ready,
    reset: () => {
      ready = false;
    },
    push: (action) => {
      held.push(action);
    },
    drain: () => {
      ready = true;
      const out = held;
      held = [];
      return out;
    },
  };
}
