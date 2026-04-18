/**
 * Canvas overlay for taxi route rendering.
 *
 * Supports two modes:
 * - network: snaps clicks to taxi network nodes, draws path through node coords
 * - freehand: arbitrary clicks, draws direct lines between points
 */
import { useEffect, useRef } from 'react';
import { buildTaxiGraph, findNearestNode } from '@/lib/taxiGraph';
import type { TaxiGraph } from '@/lib/taxiGraph';
import { useAppStore } from '@/stores/appStore';
import { useTaxiModeActive, useTaxiRouteStore } from '@/stores/taxiRouteStore';
import type { MapRef } from './useMapSetup';

const ROUTE_COLOR = '#34d399';
const ROUTE_OUTLINE = 'rgba(0, 0, 0, 0.5)';
const PULSE_SPEED = 0.02;

function tracePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  points: { longitude: number; latitude: number }[],
  width: number,
  height: number,
  phase: number
): void {
  ctx.clearRect(0, 0, width, height);
  if (points.length === 0) return;

  const zoom = map.getZoom();
  const scale = Math.max(0.5, Math.min(3, (zoom - 13) / 4));
  const pts = points.map((wp) => map.project([wp.longitude, wp.latitude]));

  if (pts.length >= 2) {
    const lineW = 12 * scale;
    const outlineW = lineW + 4 * scale;

    // Dark outline
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tracePath(ctx, pts);
    ctx.strokeStyle = ROUTE_OUTLINE;
    ctx.lineWidth = outlineW;
    ctx.stroke();
    ctx.restore();

    // Bright center fill
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tracePath(ctx, pts);
    ctx.strokeStyle = ROUTE_COLOR;
    ctx.lineWidth = lineW;
    ctx.stroke();
    ctx.restore();

    // Animated direction dashes (white, semi-transparent)
    const totalLen = pts.reduce((sum, p, i) => {
      if (i === 0) return 0;
      const prev = pts[i - 1]!;
      return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
    }, 0);

    if (totalLen > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([14 * scale, 20 * scale]);
      ctx.lineDashOffset = -(phase % 1) * totalLen;
      tracePath(ctx, pts);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 4 * scale;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // Endpoint dots only (first and last)
  if (pts.length >= 1) {
    ctx.save();
    const r = 6 * scale;
    for (const idx of [0, pts.length - 1]) {
      const p = pts[idx]!;
      // Outer ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = ROUTE_OUTLINE;
      ctx.fill();
      // Inner fill
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = ROUTE_COLOR;
      ctx.fill();
      // White center
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    }
    ctx.restore();
  }
}

function resolveNetworkPoints(
  nodeIds: number[],
  graph: TaxiGraph | null
): { longitude: number; latitude: number }[] {
  if (!graph) return [];
  const points: { longitude: number; latitude: number }[] = [];
  for (const id of nodeIds) {
    const node = graph.nodes.get(id);
    if (node) {
      points.push({ longitude: node.lon, latitude: node.lat });
    }
  }
  return points;
}

export function useTaxiRouteSync(mapRef: MapRef): void {
  const mode = useTaxiRouteStore((s) => s.mode);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);
  const networkNodeIds = useTaxiRouteStore((s) => s.networkNodeIds);
  const graph = useTaxiRouteStore((s) => s.graph);
  const taxiModeActive = useTaxiModeActive();
  const clickModeEnabled = useTaxiRouteStore((s) => s.clickModeEnabled);
  const addWaypoint = useTaxiRouteStore((s) => s.addWaypoint);
  const addNetworkNode = useTaxiRouteStore((s) => s.addNetworkNode);
  const setGraph = useTaxiRouteStore((s) => s.setGraph);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Build graph when airport data changes
  const taxiNetwork = useAppStore((s) => s.selectedAirportData?.taxiNetwork);
  useEffect(() => {
    if (taxiNetwork && taxiNetwork.nodes.length > 0 && taxiNetwork.edges.length > 0) {
      setGraph(buildTaxiGraph(taxiNetwork));
    } else {
      setGraph(null);
    }
  }, [taxiNetwork, setGraph]);

  const drawPoints = mode === 'network' ? resolveNetworkPoints(networkNodeIds, graph) : waypoints;

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

  // Click handler — reads mode/graph from store directly to avoid stale closures
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !taxiModeActive || !clickModeEnabled) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const { mode: currentMode, graph: currentGraph } = useTaxiRouteStore.getState();
      if (currentMode === 'network' && currentGraph) {
        const nearest = findNearestNode(currentGraph, e.lngLat.lng, e.lngLat.lat);
        if (nearest) {
          addNetworkNode(nearest.id);
        }
      } else {
        addWaypoint(e.lngLat.lng, e.lngLat.lat);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapRef, taxiModeActive, clickModeEnabled, addWaypoint, addNetworkNode]);

  // Drag-to-reroute — grab a point on the route and drag to a new node
  const dragRef = useRef<{
    networkIndex: number;
    previewNodeId: number | null;
  } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !taxiModeActive) return;

    const HIT_RADIUS = 15; // pixels

    const handleMouseDown = (e: maplibregl.MapMouseEvent) => {
      const { mode: m, graph: g, networkNodeIds: ids } = useTaxiRouteStore.getState();
      if (m !== 'network' || !g || ids.length < 2) return;

      const click = map.project(e.lngLat.toArray() as [number, number]);

      // Find nearest route point to click
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < ids.length; i++) {
        const node = g.nodes.get(ids[i]!);
        if (!node) continue;
        const pt = map.project([node.lon, node.lat]);
        const d = Math.hypot(pt.x - click.x, pt.y - click.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestDist > HIT_RADIUS || bestIdx < 0) return;

      // Start drag
      e.preventDefault();
      map.dragPan.disable();
      dragRef.current = { networkIndex: bestIdx, previewNodeId: null };
      map.getCanvas().style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!dragRef.current) return;
      const { graph: g } = useTaxiRouteStore.getState();
      if (!g) return;

      const nearest = findNearestNode(g, e.lngLat.lng, e.lngLat.lat, true);
      if (nearest) {
        dragRef.current.previewNodeId = nearest.id;
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current) return;
      const { previewNodeId, networkIndex } = dragRef.current;
      dragRef.current = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';

      if (previewNodeId == null) return;

      const store = useTaxiRouteStore.getState();
      // Find which anchor segment this point belongs to and insert a via-point
      const segIdx = store.findAnchorSegment(networkIndex);
      store.insertViaNode(segIdx, previewNodeId);
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      if (dragRef.current) {
        map.dragPan.enable();
        map.getCanvas().style.cursor = '';
        dragRef.current = null;
      }
    };
  }, [mapRef, taxiModeActive]);

  // Animated render loop
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !taxiModeActive) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const needsAnimation = drawPoints.length >= 2;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRoute(ctx, map, drawPoints, w, h, phaseRef.current);

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
        drawRoute(ctx, map, drawPoints, w, h, phaseRef.current);
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
  }, [mapRef, drawPoints, taxiModeActive]);
}
