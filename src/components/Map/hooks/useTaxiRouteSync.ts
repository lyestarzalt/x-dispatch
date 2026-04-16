/**
 * Canvas overlay for taxi route rendering.
 *
 * Users click on the map to add waypoints. Lines are drawn between
 * them on a transparent canvas over the map with animated directional
 * dashes (follow-the-greens style).
 */
import { useEffect, useRef } from 'react';
import { useTaxiModeActive, useTaxiRouteStore } from '@/stores/taxiRouteStore';
import type { MapRef } from './useMapSetup';

// cat-emerald from design system: oklch(0.76 0.17 163) ≈ #34d399
const ROUTE_COLOR = '#34d399';
const ROUTE_COLOR_ALPHA = 'rgba(52, 211, 153, 0.6)';
const DOT_BORDER = 'rgba(0, 0, 0, 0.4)';

// Animation
const PULSE_SPEED = 0.025;

function drawRoute(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  waypoints: { longitude: number; latitude: number }[],
  width: number,
  height: number,
  phase: number
): void {
  ctx.clearRect(0, 0, width, height);
  if (waypoints.length === 0) return;

  const zoom = map.getZoom();
  const scale = Math.max(0.5, Math.min(3, (zoom - 13) / 4));

  const pts = waypoints.map((wp) => map.project([wp.longitude, wp.latitude]));

  if (pts.length >= 2) {
    // --- Core route line ---
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    ctx.strokeStyle = ROUTE_COLOR_ALPHA;
    ctx.lineWidth = 8 * scale;
    ctx.stroke();
    ctx.restore();

    // --- Animated directional dashes ---
    const totalLen = pts.reduce((sum, p, i) => {
      if (i === 0) return 0;
      const prev = pts[i - 1]!;
      return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
    }, 0);

    if (totalLen > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const dashOffset = (phase % 1) * totalLen;
      ctx.setLineDash([10 * scale, 16 * scale]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]!.x, pts[i]!.y);
      }
      ctx.strokeStyle = ROUTE_COLOR;
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // --- Waypoint dots ---
  ctx.save();
  const r = 4 * scale;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;

    // Border
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = DOT_BORDER;
    ctx.fill();

    // Fill
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ROUTE_COLOR;
    ctx.fill();
  }
  ctx.restore();
}

export function useTaxiRouteSync(mapRef: MapRef): void {
  const waypoints = useTaxiRouteStore((s) => s.waypoints);
  const taxiModeActive = useTaxiModeActive();
  const clickModeEnabled = useTaxiRouteStore((s) => s.clickModeEnabled);
  const addWaypoint = useTaxiRouteStore((s) => s.addWaypoint);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Create canvas overlay once
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
    canvas.style.zIndex = '10';
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [mapRef]);

  // Click-to-add waypoint via MapLibre click event
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !taxiModeActive || !clickModeEnabled) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      addWaypoint(e.lngLat.lng, e.lngLat.lat);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapRef, taxiModeActive, clickModeEnabled, addWaypoint]);

  // Animated render loop — only active when taxi mode is on
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !taxiModeActive) {
      // Clear canvas when inactive
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const needsAnimation = waypoints.length >= 2;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRoute(ctx, map, waypoints, w, h, phaseRef.current);

      if (needsAnimation) {
        phaseRef.current += PULSE_SPEED;
        rafRef.current = requestAnimationFrame(render);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    render();

    const onMove = () => {
      if (!needsAnimation) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawRoute(ctx, map, waypoints, w, h, phaseRef.current);
      }
    };
    map.on('move', onMove);
    map.on('zoom', onMove);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off('move', onMove);
      map.off('zoom', onMove);
    };
  }, [mapRef, waypoints, taxiModeActive]);
}
