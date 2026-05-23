/**
 * Canvas overlay for approach light "rabbit" animation.
 *
 * Draws animated glow effects over MapLibre's static approach light circles.
 * Uses a separate canvas — no setPaintProperty, no MapLibre style dirtying,
 * no extra GPU repaints (#59).
 *
 * Light positions are cached from MapLibre source features and re-queried
 * only on moveend. Drawing uses RAF for smooth projection during panning.
 * The RAF loop only runs when the animation is enabled and visible (zoom > 14).
 */
import { useEffect, useRef } from 'react';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MapRef } from './useMapSetup';

/** Bars per second — real approach lights do ~2 sweeps/sec */
const RABBIT_SPEED = 20;
const BAR_COUNT = 30;
// Track the underlying MapLibre `airport-approach-lights` dot layer so the
// rabbit overlay and the dots come in together.
const MIN_ZOOM = ZOOM_BEHAVIORS.runwayEnds.minZoom;

interface CachedLight {
  lon: number;
  lat: number;
  barIndex: number;
}

export function useApproachLightAnimation(mapRef: MapRef): void {
  const rafRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightsRef = useRef<CachedLight[]>([]);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef(0);
  const airportIcao = useAppStore((s) => s.selectedICAO);
  const enabled = useSettingsStore((s) => s.graphics.approachLightAnimation);

  // Create/destroy canvas
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '5';
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
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

  // Animation loop
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !airportIcao || !enabled) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Query approach light positions from MapLibre source
    const queryLights = () => {
      lightsRef.current = [];
      if (map.getZoom() < MIN_ZOOM) return;
      if (!map.getLayer('airport-approach-lights')) return;

      try {
        const features = map.queryRenderedFeatures(undefined, {
          layers: ['airport-approach-lights'],
        });
        for (const f of features) {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          const barIndex = f.properties?.barIndex as number;
          if (barIndex == null || !coords) continue;
          lightsRef.current.push({ lon: coords[0]!, lat: coords[1]!, barIndex });
        }
      } catch {
        // Layer may not exist yet
      }
    };

    queryLights();
    lastTimeRef.current = performance.now();

    let cancelled = false;

    const render = () => {
      if (cancelled) return;

      const now = performance.now();
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const lights = lightsRef.current;
      if (lights.length > 0 && map.getZoom() >= MIN_ZOOM) {
        phaseRef.current += RABBIT_SPEED * dt;
        const currentBar = Math.floor(phaseRef.current % BAR_COUNT);
        const zoom = map.getZoom();
        const scale = Math.max(0.5, Math.min(2, (zoom - 13) / 4));

        for (const light of lights) {
          const barDist = (BAR_COUNT - 1 - light.barIndex - currentBar + BAR_COUNT) % BAR_COUNT;

          let alpha: number;
          let radius: number;

          if (barDist === 0) {
            // The "rabbit" — brightest flash
            alpha = 0.95;
            radius = 10 * scale;
          } else if (barDist <= 4) {
            // Fading trail
            alpha = 0.6 * (1 - barDist / 5);
            radius = 6 * scale;
          } else {
            continue;
          }

          const pt = map.project([light.lon, light.lat]);

          // Glow
          ctx.save();
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = radius * 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    // Re-query on map change (visible features may differ)
    const onMapChange = () => queryLights();
    map.on('moveend', onMapChange);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off('moveend', onMapChange);
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [mapRef, airportIcao, enabled]);
}
