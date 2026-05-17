interface StyleReadyMap {
  isStyleLoaded: () => boolean | void;
  once: (event: 'styledata', listener: () => void) => void;
  off: (event: 'styledata', listener: () => void) => void;
  style?: unknown;
}

function isStyleReadyForLayerUpdates(map: StyleReadyMap): boolean {
  const style = map.style as { _loaded?: unknown } | undefined;
  return map.isStyleLoaded() === true || style?._loaded === true;
}

export function runWhenStyleIsReady(map: StyleReadyMap, run: () => void): () => void {
  let cancelled = false;
  let pendingStyleListener: (() => void) | null = null;

  const attempt = () => {
    if (cancelled) return;

    if (isStyleReadyForLayerUpdates(map)) {
      run();
      return;
    }

    pendingStyleListener = () => {
      pendingStyleListener = null;
      attempt();
    };
    map.once('styledata', pendingStyleListener);
  };

  attempt();

  return () => {
    cancelled = true;
    if (pendingStyleListener) {
      map.off('styledata', pendingStyleListener);
      pendingStyleListener = null;
    }
  };
}
