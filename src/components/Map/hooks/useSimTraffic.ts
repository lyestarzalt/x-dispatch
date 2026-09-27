import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import type { TrafficSnapshot, TrafficTarget } from '@/types/traffic';
import {
  ensureSimTrafficLayer,
  hasSimTrafficLayer,
  removeSimTrafficLayer,
  setSimTrafficData,
} from '../layers/dynamic/SimTrafficLayer';

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

const FRAME_MS = 1000 / 30;

function lerpHeading(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

/**
 * Renders the frame between the two newest snapshots. With `t` past 1 the
 * newest position is held, which also covers the first snapshot.
 */
function interpolate(prev: TrafficSnapshot, next: TrafficSnapshot, nowMs: number): TrafficTarget[] {
  const span = next.at - prev.at;
  const t = span > 0 ? Math.min(1, (nowMs - next.at) / span) : 1;
  const bySlot = new Map(prev.targets.map((p) => [p.slot, p]));
  return next.targets.map((n) => {
    const p = bySlot.get(n.slot);
    if (!p || t >= 1) return n;
    return {
      ...n,
      latitude: p.latitude + (n.latitude - p.latitude) * t,
      longitude: p.longitude + (n.longitude - p.longitude) * t,
      altitudeFt: p.altitudeFt + (n.altitudeFt - p.altitudeFt) * t,
      headingDeg: lerpHeading(p.headingDeg, n.headingDeg, t),
    };
  });
}

/**
 * X-Plane AI and plugin traffic from the TCAS target table. The main process
 * only subscribes to the arrays while this layer is on, so an idle toggle costs
 * nothing on the sim side. Snapshots arrive twice a second; the loop below
 * glides markers between them at 30 fps and stops when the feed does.
 */
export function useSimTraffic(mapRef: MapRef): void {
  const enabled = useMapStore((s) => s.simTrafficEnabled);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;

    let cancelled = false;
    let prev: TrafficSnapshot | null = null;
    let next: TrafficSnapshot | null = null;
    let mounting = false;
    let frame = 0;
    let lastFrameMs = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = (nowMs: number) => {
      frame = 0;
      if (cancelled || !next) return;
      // Display lags one snapshot interval so there is always a segment to glide along.
      const lag = prev ? next.at - prev.at : 0;
      const displayMs = Date.now() - lag;
      // Past the newest snapshot (or nothing to glide) the drawn frame stops
      // changing: draw it once and stop the loop. The next snapshot restarts
      // it, so an idle or empty feed costs one setData per snapshot, not a
      // 30 fps loop that re-uploads identical data.
      if (!prev || next.targets.length === 0 || displayMs >= next.at) {
        setSimTrafficData(map, next.targets);
        return;
      }
      if (nowMs - lastFrameMs >= FRAME_MS) {
        lastFrameMs = nowMs;
        setSimTrafficData(map, interpolate(prev, next, displayMs));
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (cancelled || frame || document.hidden) return;
      frame = requestAnimationFrame(tick);
    };

    const mount = async (snapshot: TrafficSnapshot) => {
      if (mounting) return;
      mounting = true;
      try {
        await ensureSimTrafficLayer(map, snapshot.targets);
      } finally {
        mounting = false;
      }
      if (!cancelled) start();
    };

    const seenIcaoTypes = new Set<string>();
    const unsubscribe = window.xplaneServiceAPI.onTrafficUpdate((snapshot) => {
      prev = next;
      next = snapshot;
      // Mount only when the layer is missing (first call, style reload) or a
      // new type needs its silhouette fetched — not on every snapshot.
      let hasNewType = false;
      for (const t of snapshot.targets) {
        if (t.icaoType && !seenIcaoTypes.has(t.icaoType)) {
          seenIcaoTypes.add(t.icaoType);
          hasNewType = true;
        }
      }
      if (hasNewType || !hasSimTrafficLayer(map)) {
        void mount(snapshot);
      }
      start();
    });
    void window.xplaneServiceAPI.setTrafficEnabled(true);

    const onStyleLoad = () => {
      if (next) void mount(next);
    };
    map.on('style.load', onStyleLoad);
    document.addEventListener('visibilitychange', start);

    return () => {
      cancelled = true;
      stop();
      unsubscribe();
      map.off('style.load', onStyleLoad);
      document.removeEventListener('visibilitychange', start);
      void window.xplaneServiceAPI.setTrafficEnabled(false);
      removeSimTrafficLayer(map);
    };
  }, [mapRef, enabled]);
}
