import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { airfieldLightFactor } from '@/lib/airportLights/lightFactor';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSolarStore } from '@/stores/solarStore';

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

type StrobeKind = 'reil' | 'pulse' | 'beacon';

interface Strobe {
  lon: number;
  lat: number;
  kind: StrobeKind;
}

/** REIL pairs flash together about once a second. */
const REIL_PERIOD_MS = 1000;
const REIL_ON_MS = 70;
/** Civil beacon: alternating white and green, 24 flashes a minute. */
const BEACON_PERIOD_MS = 2500;
const BEACON_ON_MS = 140;
const PULSE_PERIOD_MS = 1000;

const BEACON_MIN_ZOOM = ZOOM_BEHAVIORS.beacon.minZoom;
const FIXTURE_MIN_ZOOM = ZOOM_BEHAVIORS.lighting.minZoom;

function collect(map: maplibregl.Map): Strobe[] {
  const out: Strobe[] = [];
  const seen = new Set<string>();
  const push = (f: GeoJSON.Feature, kind: StrobeKind) => {
    if (f.geometry.type !== 'Point') return;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    const key = `${kind}:${lon.toFixed(6)},${lat.toFixed(6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ lon, lat, kind });
  };
  if (map.getSource('airport-runway-lights')) {
    for (const f of map.querySourceFeatures('airport-runway-lights', {
      filter: ['==', ['get', 'type'], 'reil'],
    })) {
      push(f, 'reil');
    }
  }
  if (map.getSource('airport-taxiway-lights')) {
    for (const f of map.querySourceFeatures('airport-taxiway-lights', {
      filter: ['==', ['get', 'pulse'], true],
    })) {
      push(f, 'pulse');
    }
  }
  if (map.getSource('airport-beacon')) {
    for (const f of map.querySourceFeatures('airport-beacon')) push(f, 'beacon');
  }
  return out;
}

/**
 * Flashing fixtures drawn on a 2D canvas over the map: REIL strobes,
 * pulsating hold bars and the rotating beacon. Positions are cached from the
 * GeoJSON sources and re-projected per frame; the loop stops itself when
 * nothing is in view or the sun is up.
 */
export function useAirfieldStrobes(mapRef: MapRef): void {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strobesRef = useRef<Strobe[]>([]);
  const rafRef = useRef(0);
  const airport = useAppStore((s) => s.selectedAirportData);
  const mode = useSettingsStore((s) => s.graphics.airfieldLights);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5';
    container.appendChild(canvas);
    canvasRef.current = canvas;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      canvas.remove();
      canvasRef.current = null;
    };
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    if (!airport || mode === 'off') {
      clear();
      return;
    }

    let cancelled = false;
    let running = false;
    let factor = 0;

    const refreshFactor = () => {
      factor = airfieldLightFactor(
        mode,
        useSolarStore.getState().timeMs,
        airport.latitude,
        airport.longitude
      );
    };

    const visible = () =>
      factor > 0.05 &&
      strobesRef.current.some((s) =>
        s.kind === 'beacon' ? map.getZoom() >= BEACON_MIN_ZOOM : map.getZoom() >= FIXTURE_MIN_ZOOM
      );

    const drawLight = (x: number, y: number, radius: number, rgb: string, alpha: number) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(255,255,255,${alpha})`);
      glow.addColorStop(0.3, `rgba(${rgb},${alpha * 0.8})`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = () => {
      if (cancelled) return;
      if (!visible()) {
        clear();
        running = false;
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const now = performance.now();
      const zoom = map.getZoom();
      const scale = Math.max(0.6, Math.min(3, 2 ** (zoom - 15)));
      const reilOn = now % REIL_PERIOD_MS < REIL_ON_MS;
      const beaconPhase = now % BEACON_PERIOD_MS;
      const beaconOn = beaconPhase < BEACON_ON_MS;
      const beaconGreen = Math.floor(now / BEACON_PERIOD_MS) % 2 === 1;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((now / PULSE_PERIOD_MS) * Math.PI * 2));

      for (const s of strobesRef.current) {
        if (s.kind === 'beacon') {
          if (!beaconOn || zoom < BEACON_MIN_ZOOM) continue;
          const pt = map.project([s.lon, s.lat]);
          drawLight(pt.x, pt.y, 22 * scale, beaconGreen ? '80,255,120' : '255,250,235', factor);
        } else if (zoom >= FIXTURE_MIN_ZOOM) {
          if (s.kind === 'reil' && !reilOn) continue;
          const pt = map.project([s.lon, s.lat]);
          if (s.kind === 'reil') drawLight(pt.x, pt.y, 12 * scale, '255,250,235', factor);
          else drawLight(pt.x, pt.y, 5 * scale, '255,190,60', factor * pulse);
        }
      }
      rafRef.current = requestAnimationFrame(render);
    };

    const start = () => {
      if (running || cancelled || !visible()) return;
      running = true;
      rafRef.current = requestAnimationFrame(render);
    };

    const refresh = () => {
      strobesRef.current = collect(map);
      refreshFactor();
      start();
    };

    refresh();
    map.on('moveend', refresh);
    map.on('idle', refresh);
    const unsubscribe = useSolarStore.subscribe((state, prev) => {
      if (state.timeMs !== prev.timeMs) {
        refreshFactor();
        start();
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      map.off('moveend', refresh);
      map.off('idle', refresh);
      unsubscribe();
      clear();
    };
  }, [mapRef, airport, mode]);
}
