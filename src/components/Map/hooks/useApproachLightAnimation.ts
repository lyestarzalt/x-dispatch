/**
 * Canvas overlay for approach light "rabbit" animation.
 *
 * Draws animated glow effects over MapLibre's static approach light circles.
 * Uses a separate canvas — no setPaintProperty, no MapLibre style dirtying,
 * no extra GPU repaints (#59).
 *
 * Light positions are cached from MapLibre source features and re-queried
 * only on moveend. The loop only paints when the rabbit steps to the next
 * bar or the map is moving, glows are stamped from pre-rendered sprites, and
 * only the area painted last time is cleared. It stops itself when there is
 * nothing to draw at the current zoom and is restarted from moveend.
 */
import { useEffect, useRef } from 'react';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MapRef } from './useMapSetup';

/** Bars per second — real approach lights do ~2 sweeps/sec */
const RABBIT_SPEED = 20;
const BAR_COUNT = 30;
/** The flash plus this many fading bars behind it. */
const TRAIL_BARS = 4;
const FLASH_ALPHA = 0.95;
const FLASH_RADIUS = 10;
const TRAIL_RADIUS = 6;
/** Soft glows do not need retina pixels; 1x quarters the fill cost on 2x screens. */
const MAX_BACKING_SCALE = 1;
/** Glow halo reaches this far beyond the disc, as the old shadow blur did. */
const GLOW_REACH = 2.5;
// Track the underlying MapLibre `airport-approach-lights` dot layer so the
// rabbit overlay and the dots come in together.
const MIN_ZOOM = ZOOM_BEHAVIORS.runwayEnds.minZoom;

interface CachedLight {
  lon: number;
  lat: number;
}

interface Glow {
  canvas: HTMLCanvasElement;
  /** Half the sprite size, in canvas pixels. */
  half: number;
}

function backingScale(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_BACKING_SCALE);
}

/** A white disc with a soft halo, drawn once so frames only stamp it. */
function makeGlow(radius: number): Glow {
  const half = Math.ceil(radius * GLOW_REACH);
  const canvas = document.createElement('canvas');
  canvas.width = half * 2;
  canvas.height = half * 2;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(radius / half, 'rgba(255, 255, 255, 0.85)');
  g.addColorStop(Math.min(1, (radius * 1.6) / half), 'rgba(255, 255, 255, 0.25)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, half * 2, half * 2);
  return { canvas, half };
}

export function useApproachLightAnimation(mapRef: MapRef): void {
  const rafRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barsRef = useRef<CachedLight[][]>([]);
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
      const scale = backingScale();
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
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

    // Query approach light positions from MapLibre source, grouped by bar so a
    // frame only touches the handful of bars that are lit.
    const queryLights = () => {
      barsRef.current = [];
      if (map.getZoom() < MIN_ZOOM) return;
      if (!map.getLayer('airport-approach-lights')) return;

      try {
        const features = map.queryRenderedFeatures(undefined, {
          layers: ['airport-approach-lights'],
        });
        const bars: CachedLight[][] = [];
        for (const f of features) {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          const barIndex = f.properties?.barIndex as number;
          if (barIndex == null || !coords) continue;
          (bars[barIndex] ??= []).push({ lon: coords[0]!, lat: coords[1]! });
        }
        barsRef.current = bars;
      } catch {
        // Layer may not exist yet
      }
    };

    let cancelled = false;
    let running = false;
    let lastBar = -1;
    let lastWidth = 0;
    let lastHeight = 0;
    /** Area painted by the previous frame, in canvas pixels; cleared before the next. */
    let dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
    /** Sprites for the current zoom scale, rebuilt when the scale changes. */
    let glowScale = -1;
    let flashGlow: Glow | null = null;
    let trailGlow: Glow | null = null;
    const startedAt = performance.now();

    const clearDirty = () => {
      if (!dirty) return;
      ctx.clearRect(dirty.x0, dirty.y0, dirty.x1 - dirty.x0, dirty.y1 - dirty.y0);
      dirty = null;
    };
    const clearAll = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty = null;
    };

    const glowsFor = (scale: number) => {
      const rounded = Math.round(scale * 20) / 20;
      if (rounded !== glowScale) {
        glowScale = rounded;
        const px = backingScale();
        flashGlow = makeGlow(FLASH_RADIUS * rounded * px);
        trailGlow = makeGlow(TRAIL_RADIUS * rounded * px);
      }
      return { flash: flashGlow!, trail: trailGlow! };
    };

    const render = () => {
      if (cancelled) return;

      const bars = barsRef.current;
      if (bars.length === 0 || map.getZoom() < MIN_ZOOM) {
        clearAll();
        running = false;
        return;
      }

      const bar = Math.floor(((performance.now() - startedAt) / 1000) * RABBIT_SPEED) % BAR_COUNT;
      const resized = canvas.width !== lastWidth || canvas.height !== lastHeight;
      // Between steps the picture is unchanged unless the map is moving under it.
      if (bar === lastBar && !map.isMoving() && !resized) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      lastBar = bar;
      if (resized) {
        lastWidth = canvas.width;
        lastHeight = canvas.height;
        dirty = null;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      clearDirty();

      const px = backingScale();
      const zoom = map.getZoom();
      const scale = Math.max(0.5, Math.min(2, (zoom - 13) / 4));
      const glows = glowsFor(scale);
      const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

      // Flash first, then the fading trail behind it: one alpha and one sprite per bar.
      for (let barDist = 0; barDist <= TRAIL_BARS; barDist++) {
        const barIndex = (BAR_COUNT - 1 - bar - barDist + 2 * BAR_COUNT) % BAR_COUNT;
        const lights = bars[barIndex];
        if (!lights || lights.length === 0) continue;
        const glow = barDist === 0 ? glows.flash : glows.trail;
        ctx.globalAlpha = barDist === 0 ? FLASH_ALPHA : 0.6 * (1 - barDist / (TRAIL_BARS + 1));
        for (const light of lights) {
          const pt = map.project([light.lon, light.lat]);
          const x = pt.x * px - glow.half;
          const y = pt.y * px - glow.half;
          ctx.drawImage(glow.canvas, x, y);
          if (x < box.x0) box.x0 = x;
          if (y < box.y0) box.y0 = y;
          if (x + glow.half * 2 > box.x1) box.x1 = x + glow.half * 2;
          if (y + glow.half * 2 > box.y1) box.y1 = y + glow.half * 2;
        }
      }
      ctx.globalAlpha = 1;
      if (box.x0 < box.x1) {
        dirty = {
          x0: Math.floor(box.x0) - 1,
          y0: Math.floor(box.y0) - 1,
          x1: Math.ceil(box.x1) + 1,
          y1: Math.ceil(box.y1) + 1,
        };
      }

      rafRef.current = requestAnimationFrame(render);
    };

    const start = () => {
      if (running || cancelled) return;
      if (barsRef.current.length === 0 || map.getZoom() < MIN_ZOOM) return;
      running = true;
      lastBar = -1;
      rafRef.current = requestAnimationFrame(render);
    };

    queryLights();
    start();

    // Re-query on map change (visible features may differ)
    const onMapChange = () => {
      queryLights();
      lastBar = -1;
      start();
    };
    map.on('moveend', onMapChange);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off('moveend', onMapChange);
      clearAll();
    };
  }, [mapRef, airportIcao, enabled]);
}
