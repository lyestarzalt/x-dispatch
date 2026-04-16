/**
 * Canvas overlay for taxi route rendering.
 *
 * Users click on the map to add waypoints. Lines are drawn between them
 * on a transparent canvas over the map. Simple, reliable, no pathfinding.
 *
 * Visual: green glow lines with animated pulse, direction arrows,
 * numbered waypoint markers.
 */
import { useEffect, useRef } from 'react';
import { useTaxiModeActive, useTaxiRouteStore } from '@/stores/taxiRouteStore';
import type { MapRef } from './useMapSetup';

// Green glow colours
const LINE_COLOR = '#22c55e';
const GLOW_COLOR = 'rgba(34, 197, 94, 0.3)';
const CASING_COLOR = '#ffffff';
const ARROW_COLOR = '#ffffff';
const LABEL_COLOR = '#ffffff';

// Animation
const PULSE_SPEED = 0.03;

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
  const scale = Math.max(0.5, Math.min(3.5, (zoom - 13) / 4));

  // Project all waypoints
  const pts = waypoints.map((wp) => map.project([wp.longitude, wp.latitude]));

  if (pts.length >= 2) {
    // --- Glow ---
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    ctx.strokeStyle = GLOW_COLOR;
    ctx.lineWidth = 20 * scale;
    ctx.stroke();
    ctx.restore();

    // --- Casing ---
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    ctx.strokeStyle = CASING_COLOR;
    ctx.lineWidth = 9 * scale;
    ctx.stroke();
    ctx.restore();

    // --- Core green line ---
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x, pts[i]!.y);
    }
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 5 * scale;
    ctx.stroke();
    ctx.restore();

    // --- Animated pulse dashes ---
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
      ctx.setLineDash([14 * scale, 22 * scale]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]!.x, pts[i]!.y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // --- Direction arrows along segments ---
    ctx.save();
    ctx.globalAlpha = 0.7;
    const arrowSize = 7 * scale;
    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1]!;
      const p2 = pts[i]!;
      const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (segLen < 40 * scale) continue;

      const spacing = 80 * scale;
      const count = Math.floor(segLen / spacing);
      for (let j = 1; j <= count; j++) {
        const t = j / (count + 1);
        const mx = p1.x + (p2.x - p1.x) * t;
        const my = p1.y + (p2.y - p1.y) * t;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.beginPath();
        ctx.moveTo(mx + arrowSize * Math.cos(angle), my + arrowSize * Math.sin(angle));
        ctx.lineTo(
          mx + arrowSize * Math.cos(angle + (2.5 * Math.PI) / 3),
          my + arrowSize * Math.sin(angle + (2.5 * Math.PI) / 3)
        );
        ctx.lineTo(
          mx + arrowSize * Math.cos(angle - (2.5 * Math.PI) / 3),
          my + arrowSize * Math.sin(angle - (2.5 * Math.PI) / 3)
        );
        ctx.closePath();
        ctx.fillStyle = ARROW_COLOR;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Waypoint markers ---
  ctx.save();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const r = 11 * scale;

    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2);
    ctx.fillStyle = CASING_COLOR;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = LINE_COLOR;
    ctx.fill();

    if (pts.length > 1) {
      const fontSize = Math.max(13, 16 * scale);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = LABEL_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, p.x, p.y + 0.5);
    }
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

  // Click-to-add waypoint — listen on the map container directly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!taxiModeActive || !clickModeEnabled) return;
      addWaypoint(e.lngLat.lng, e.lngLat.lat);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapRef, taxiModeActive, clickModeEnabled, addWaypoint]);

  // Animated render loop
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const theWaypoints = taxiModeActive ? waypoints : [];
    const needsAnimation = theWaypoints.length >= 2;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRoute(ctx, map, theWaypoints, w, h, phaseRef.current);

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
        drawRoute(ctx, map, theWaypoints, w, h, phaseRef.current);
      }
    };
    map.on('move', onMove);
    map.on('zoom', onMove);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off('move', onMove);
      map.off('zoom', onMove);
    };
  }, [mapRef, waypoints, taxiModeActive]);
}
