import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { usePlaneStore } from '@/stores/planeStore';
import type { PlaneState } from '@/types/xplane';

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

/** Below this the wingtips collapse into the marker, so only the beacon is drawn at the centre. */
const WINGTIP_MIN_ZOOM = 13;
const MIN_ZOOM = 9;
const BEACON_PERIOD_MS = 1200;
const BEACON_ON_MS = 120;
const STROBE_PERIOD_MS = 1400;
const STROBE_ON_MS = 60;
/** Second flash of the strobe double-blink, offset from the first. */
const STROBE_GAP_MS = 160;
const DEFAULT_WINGSPAN_M = 30;

const RED = '255,64,64';
const GREEN = '64,255,120';
const WHITE = '255,255,255';

function metersPerPixel(zoom: number, latDeg: number): number {
  return (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / 2 ** zoom;
}

function backingScale(): number {
  return Math.min(window.devicePixelRatio || 1, 1);
}

function lightsOn(state: PlaneState | null): boolean {
  return !!state && (!!state.navLightsOn || !!state.beaconOn || !!state.strobesOn);
}

/**
 * Own-aircraft navigation lights, beacon and strobes on a screen-space canvas,
 * driven by the sim's own switches. The loop wakes only at flash edges and on
 * position or camera changes, so the map itself never repaints for a blink.
 */
export function useOwnAircraftLights(mapRef: MapRef): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:6';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const scale = backingScale();
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const dot = (x: number, y: number, rgb: string, radius: number, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
      g.addColorStop(0, `rgba(${rgb},${alpha})`);
      g.addColorStop(0.35, `rgba(${rgb},${alpha * 0.5})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    };

    /** Milliseconds until the next beacon or strobe edge, so the loop sleeps between blinks. */
    const untilNextEdge = (now: number, state: PlaneState): number => {
      let next = Infinity;
      if (state.beaconOn) {
        const p = now % BEACON_PERIOD_MS;
        next = Math.min(next, p < BEACON_ON_MS ? BEACON_ON_MS - p : BEACON_PERIOD_MS - p);
      }
      if (state.strobesOn) {
        const p = now % STROBE_PERIOD_MS;
        const edges = [
          0,
          STROBE_ON_MS,
          STROBE_GAP_MS,
          STROBE_GAP_MS + STROBE_ON_MS,
          STROBE_PERIOD_MS,
        ];
        for (const e of edges) if (e > p) next = Math.min(next, e - p);
      }
      return Number.isFinite(next) ? Math.max(16, next) : 0;
    };

    const draw = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = undefined;
      const state = usePlaneStore.getState().state;
      clear();
      if (!state || !lightsOn(state) || document.hidden || map.getZoom() < MIN_ZOOM) return;

      const scale = backingScale();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const zoom = map.getZoom();
      const center = map.project([state.longitude, state.latitude]);
      const now = performance.now();
      const beaconLit = state.beaconOn && now % BEACON_PERIOD_MS < BEACON_ON_MS;
      const strobePhase = now % STROBE_PERIOD_MS;
      const strobeLit =
        state.strobesOn &&
        (strobePhase < STROBE_ON_MS ||
          (strobePhase >= STROBE_GAP_MS && strobePhase < STROBE_GAP_MS + STROBE_ON_MS));

      const radius = Math.max(1.2, Math.min(3.5, (zoom - 10) * 0.5));

      if (zoom >= WINGTIP_MIN_ZOOM) {
        const spanPx =
          (state.wingspanM ?? DEFAULT_WINGSPAN_M) / metersPerPixel(zoom, state.latitude);
        const half = spanPx / 2;
        const rad = ((state.heading - map.getBearing()) * Math.PI) / 180;
        // Wingtips sit perpendicular to the heading; the tail sits behind by roughly half the span.
        const rx = Math.cos(rad) * half;
        const ry = Math.sin(rad) * half;
        const tx = -Math.sin(rad) * half * 0.9;
        const ty = Math.cos(rad) * half * 0.9;
        if (state.navLightsOn) {
          dot(center.x - rx, center.y - ry, RED, radius, 0.9);
          dot(center.x + rx, center.y + ry, GREEN, radius, 0.9);
          dot(center.x + tx, center.y + ty, WHITE, radius * 0.8, 0.8);
        }
        if (strobeLit) {
          dot(center.x - rx, center.y - ry, WHITE, radius * 1.6, 1);
          dot(center.x + rx, center.y + ry, WHITE, radius * 1.6, 1);
        }
        if (beaconLit) dot(center.x, center.y, RED, radius * 1.3, 1);
      } else if (beaconLit || strobeLit) {
        dot(center.x, center.y, beaconLit ? RED : WHITE, radius * 1.2, 1);
      }

      const wait = untilNextEdge(now, state);
      if (wait > 0) timer = setTimeout(draw, wait);
    };

    const unsubscribe = usePlaneStore.subscribe((s, prev) => {
      if (s.state !== prev.state) draw();
    });
    map.on('move', draw);
    document.addEventListener('visibilitychange', draw);
    draw();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      map.off('move', draw);
      document.removeEventListener('visibilitychange', draw);
      observer.disconnect();
      canvas.remove();
    };
  }, [mapRef]);
}
