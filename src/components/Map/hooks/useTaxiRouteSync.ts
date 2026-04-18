/**
 * Canvas overlay for taxi route rendering and drag-to-reroute interaction.
 *
 * Two modes:
 * - network: snaps clicks to taxi network nodes, draws path through node coords
 * - freehand: arbitrary clicks, draws direct lines between points
 *
 * Drag-to-reroute: hover near the route line to see a grab handle,
 * drag it to reroute through a different taxiway node.
 */
import { useEffect, useRef } from 'react';
import { buildTaxiGraph, findNearestNode } from '@/lib/taxiGraph';
import type { TaxiGraph } from '@/lib/taxiGraph';
import { useAppStore } from '@/stores/appStore';
import { resolveFullPath, useTaxiModeActive, useTaxiRouteStore } from '@/stores/taxiRouteStore';
import type { MapRef } from './useMapSetup';

// ============================================================================
// Visual constants — aviation EFB style
// ============================================================================

/** Primary route color — taxi clearance green */
const ROUTE_GREEN = '#22c55e';
/** Dark casing for contrast on any surface */
const ROUTE_CASING = 'rgba(0, 0, 0, 0.7)';
/** Handle color when hovering — white for contrast against green route */
const HANDLE_COLOR = '#ffffff';
/** Drag preview */
/** Preview: same green as route but faded, with dashes */
const PREVIEW_COLOR = 'rgba(34, 197, 94, 0.35)';

const PULSE_SPEED = 0.015;
/** Pixel radius for detecting hover near route */
const HIT_TOLERANCE = 18;

// ============================================================================
// Geometry helpers
// ============================================================================

interface Pt {
  x: number;
  y: number;
}

/** Distance from point P to line segment AB, returns distance and closest point */
function pointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(px - ax, py - ay), t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { dist: Math.hypot(px - cx, py - cy), t };
}

/** Find closest point on the polyline to the cursor */
function findClosestOnLine(
  pts: Pt[],
  cursor: Pt
): { segIndex: number; t: number; dist: number; point: Pt } | null {
  if (pts.length < 2) return null;
  let bestDist = Infinity;
  let bestSeg = 0;
  let bestT = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const { dist, t } = pointToSegment(cursor.x, cursor.y, a.x, a.y, b.x, b.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestSeg = i;
      bestT = t;
    }
  }
  const a = pts[bestSeg]!;
  const b = pts[bestSeg + 1]!;
  return {
    segIndex: bestSeg,
    t: bestT,
    dist: bestDist,
    point: { x: a.x + bestT * (b.x - a.x), y: a.y + bestT * (b.y - a.y) },
  };
}

// ============================================================================
// Drawing
// ============================================================================

function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
}

/** Draw directional chevrons along the path */
function drawChevrons(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  scale: number,
  phase: number
): void {
  if (pts.length < 2) return;

  const spacing = 40 * scale;
  const chevronSize = 5 * scale;
  let accumulated = (phase * spacing) % spacing; // animate offset

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen === 0) continue;
    const dx = (b.x - a.x) / segLen;
    const dy = (b.y - a.y) / segLen;

    while (accumulated < segLen) {
      const cx = a.x + dx * accumulated;
      const cy = a.y + dy * accumulated;
      // Perpendicular
      const px = -dy;
      const py = dx;

      ctx.beginPath();
      ctx.moveTo(
        cx - dx * chevronSize + px * chevronSize,
        cy - dy * chevronSize + py * chevronSize
      );
      ctx.lineTo(cx, cy);
      ctx.lineTo(
        cx - dx * chevronSize - px * chevronSize,
        cy - dy * chevronSize - py * chevronSize
      );
      ctx.stroke();

      accumulated += spacing;
    }
    accumulated -= segLen;
  }
  ctx.restore();
}

/** Draw an endpoint marker (gate or runway) */
function drawEndpoint(ctx: CanvasRenderingContext2D, p: Pt, scale: number, isStart: boolean): void {
  const r = 7 * scale;

  // Outer ring
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 2.5, 0, Math.PI * 2);
  ctx.fillStyle = ROUTE_CASING;
  ctx.fill();

  // Color fill
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = ROUTE_GREEN;
  ctx.fill();

  // Inner icon — square for gate, triangle for runway
  ctx.fillStyle = 'white';
  if (isStart) {
    // Small square
    const s = r * 0.35;
    ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
  } else {
    // Small triangle pointing in the route direction
    const s = r * 0.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x - s, p.y + s * 0.7);
    ctx.lineTo(p.x + s, p.y + s * 0.7);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draw the drag handle (shown on hover near route) */
function drawHandle(ctx: CanvasRenderingContext2D, p: Pt, scale: number, grabbed: boolean): void {
  const r = grabbed ? 8 * scale : 6 * scale;

  ctx.save();
  // Glow
  ctx.shadowColor = ROUTE_GREEN;
  ctx.shadowBlur = grabbed ? 12 : 8;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = HANDLE_COLOR;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dark ring
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = ROUTE_CASING;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.restore();
}

interface DrawState {
  hoverPoint: Pt | null;
  isDragging: boolean;
  previewPoints: Pt[] | null;
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  points: { longitude: number; latitude: number }[],
  width: number,
  height: number,
  phase: number,
  drawState: DrawState
): void {
  ctx.clearRect(0, 0, width, height);
  if (points.length === 0) return;

  const zoom = map.getZoom();
  const scale = Math.max(0.5, Math.min(3, (zoom - 13) / 4));
  const pts = points.map((wp) => map.project([wp.longitude, wp.latitude]));

  if (pts.length >= 2) {
    const lineW = 10 * scale;
    const casingW = lineW + 4 * scale;

    // Casing (dark outline)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tracePath(ctx, pts);
    ctx.strokeStyle = ROUTE_CASING;
    ctx.lineWidth = casingW;
    ctx.stroke();
    ctx.restore();

    // Main line
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tracePath(ctx, pts);
    ctx.strokeStyle = ROUTE_GREEN;
    ctx.lineWidth = lineW;
    ctx.stroke();
    ctx.restore();

    // Directional chevrons
    drawChevrons(ctx, pts, scale, phase);

    // Drag preview path (yellow dashed)
    if (drawState.previewPoints && drawState.previewPoints.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([8 * scale, 8 * scale]);
      tracePath(ctx, drawState.previewPoints);
      ctx.strokeStyle = PREVIEW_COLOR;
      ctx.lineWidth = 6 * scale;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // Endpoints
  if (pts.length >= 2) {
    drawEndpoint(ctx, pts[0]!, scale, true);
    drawEndpoint(ctx, pts[pts.length - 1]!, scale, false);
  } else if (pts.length === 1) {
    drawEndpoint(ctx, pts[0]!, scale, true);
  }

  // Hover/drag handle
  if (drawState.hoverPoint) {
    drawHandle(ctx, drawState.hoverPoint, scale, drawState.isDragging);
  }
}

// ============================================================================
// Coordinate resolvers
// ============================================================================

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

// ============================================================================
// Hook
// ============================================================================

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

  // Drag/hover state — mutated directly, not React state (perf)
  const interactionRef = useRef<{
    hoverPoint: Pt | null;
    isDragging: boolean;
    /** 'anchor' = moving an existing anchor, 'line' = inserting a new via-point */
    dragType: 'anchor' | 'line';
    /** Index into clickedNodeIds when dragging an anchor */
    dragAnchorIndex: number;
    /** Segment index in the line for insertion */
    dragSegIndex: number;
    previewNodeId: number | null;
    previewPoints: Pt[] | null;
  }>({
    hoverPoint: null,
    isDragging: false,
    dragType: 'line',
    dragAnchorIndex: -1,
    dragSegIndex: -1,
    previewNodeId: null,
    previewPoints: null,
  });

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
      // Don't handle click if we just finished a drag
      if (interactionRef.current.isDragging) return;

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

  // Hover + drag-to-reroute interaction
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance || !taxiModeActive) return;

    const mapCanvas = mapInstance.getCanvas();
    const ANCHOR_HIT = 12; // pixels — tighter for anchor dots
    // Non-null alias for use in closures (guarded above)
    const map = mapInstance;

    /** Project clickedNodeIds to screen coords for anchor hit-testing */
    function getAnchorScreenPts(g: TaxiGraph, clicked: number[]): { pt: Pt; anchorIdx: number }[] {
      const result: { pt: Pt; anchorIdx: number }[] = [];
      for (let i = 0; i < clicked.length; i++) {
        const node = g.nodes.get(clicked[i]!);
        if (node) {
          result.push({ pt: map.project([node.lon, node.lat]), anchorIdx: i });
        }
      }
      return result;
    }

    /** Build a preview path for the current drag state */
    function buildPreview(
      inter: typeof interactionRef.current,
      g: TaxiGraph,
      clicked: number[]
    ): Pt[] | null {
      if (inter.previewNodeId == null) return null;

      let hypothetical: number[];
      if (inter.dragType === 'anchor') {
        hypothetical = [...clicked];
        hypothetical[inter.dragAnchorIndex] = inter.previewNodeId;
      } else {
        hypothetical = [
          ...clicked.slice(0, inter.dragSegIndex + 1),
          inter.previewNodeId,
          ...clicked.slice(inter.dragSegIndex + 1),
        ];
      }

      const nodeIds = resolveFullPath(hypothetical, g);
      const pts: Pt[] = [];
      for (const id of nodeIds) {
        const node = g.nodes.get(id);
        if (node) pts.push(map.project([node.lon, node.lat]));
      }
      return pts.length >= 2 ? pts : null;
    }

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      const inter = interactionRef.current;
      const {
        mode: m,
        graph: g,
        networkNodeIds: ids,
        clickedNodeIds: clicked,
      } = useTaxiRouteStore.getState();

      if (m !== 'network' || !g || ids.length < 2) {
        if (inter.hoverPoint) {
          inter.hoverPoint = null;
          mapCanvas.style.cursor = '';
        }
        return;
      }

      const cursor = map.project(e.lngLat.toArray() as [number, number]);

      if (inter.isDragging) {
        // Snap to nearest connected node
        const nearest = findNearestNode(g, e.lngLat.lng, e.lngLat.lat, true);
        if (nearest) {
          inter.previewNodeId = nearest.id;
          const node = g.nodes.get(nearest.id);
          if (node) {
            inter.hoverPoint = map.project([node.lon, node.lat]);
          }
          // Build ghost preview
          inter.previewPoints = buildPreview(inter, g, clicked);
        }
        return;
      }

      // --- Not dragging: check hover ---

      // 1. Check anchor points first (start, end, via-points)
      const anchors = getAnchorScreenPts(g, clicked);
      for (const { pt, anchorIdx } of anchors) {
        const d = Math.hypot(pt.x - cursor.x, pt.y - cursor.y);
        if (d < ANCHOR_HIT) {
          inter.hoverPoint = pt;
          inter.dragType = 'anchor';
          inter.dragAnchorIndex = anchorIdx;
          inter.dragSegIndex = -1;
          mapCanvas.style.cursor = 'grab';
          return;
        }
      }

      // 2. Check proximity to route line
      const linePts: Pt[] = [];
      for (const id of ids) {
        const node = g.nodes.get(id);
        if (node) linePts.push(map.project([node.lon, node.lat]));
      }

      const closest = findClosestOnLine(linePts, cursor);
      if (closest && closest.dist < HIT_TOLERANCE) {
        inter.hoverPoint = closest.point;
        inter.dragType = 'line';
        inter.dragAnchorIndex = -1;
        // Find which anchor segment this falls in
        const store = useTaxiRouteStore.getState();
        inter.dragSegIndex = store.findAnchorSegment(closest.segIndex);
        mapCanvas.style.cursor = 'grab';
      } else {
        inter.hoverPoint = null;
        inter.dragType = 'line';
        inter.dragAnchorIndex = -1;
        inter.dragSegIndex = -1;
        mapCanvas.style.cursor = '';
      }
    };

    const handleMouseDown = (e: maplibregl.MapMouseEvent) => {
      const inter = interactionRef.current;
      if (!inter.hoverPoint) return;
      if (inter.dragType === 'anchor' && inter.dragAnchorIndex < 0) return;
      if (inter.dragType === 'line' && inter.dragSegIndex < 0) return;

      e.preventDefault();
      inter.isDragging = true;
      inter.previewNodeId = null;
      inter.previewPoints = null;
      map.dragPan.disable();
      mapCanvas.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
      const inter = interactionRef.current;
      if (!inter.isDragging) return;

      const nodeId = inter.previewNodeId;
      const dragType = inter.dragType;
      const anchorIdx = inter.dragAnchorIndex;
      const segIdx = inter.dragSegIndex;

      // Reset
      inter.isDragging = false;
      inter.previewNodeId = null;
      inter.previewPoints = null;
      inter.hoverPoint = null;
      map.dragPan.enable();
      mapCanvas.style.cursor = '';

      if (nodeId == null) return;

      const store = useTaxiRouteStore.getState();
      if (dragType === 'anchor' && anchorIdx >= 0) {
        store.replaceNetworkNode(anchorIdx, nodeId);
      } else if (dragType === 'line' && segIdx >= 0) {
        store.insertViaNode(segIdx, nodeId);
      }
    };

    map.on('mousemove', handleMouseMove);
    map.on('mousedown', handleMouseDown);
    map.on('mouseup', handleMouseUp);

    const interSnap = interactionRef.current;
    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mousedown', handleMouseDown);
      map.off('mouseup', handleMouseUp);
      if (interSnap.isDragging) {
        interSnap.isDragging = false;
        map.dragPan.enable();
        mapCanvas.style.cursor = '';
      }
    };
  }, [mapRef, taxiModeActive]);

  // Render loop — only animates when there's a route with 2+ points
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

    let cancelled = false;
    const needsAnimation = drawPoints.length >= 2;

    const renderOnce = () => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const inter = interactionRef.current;
      drawRoute(ctx, map, drawPoints, w, h, phaseRef.current, {
        hoverPoint: inter.hoverPoint,
        isDragging: inter.isDragging,
        previewPoints: inter.previewPoints,
      });
    };

    const animationLoop = () => {
      if (cancelled) return;
      phaseRef.current += PULSE_SPEED;
      renderOnce();
      rafRef.current = requestAnimationFrame(animationLoop);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (needsAnimation) {
      // Animate chevrons
      animationLoop();
    } else {
      // Static render — no animation needed
      renderOnce();
    }

    // Re-render on map movement (panning/zooming)
    const onMapChange = () => {
      if (!needsAnimation) renderOnce();
    };
    map.on('move', onMapChange);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off('move', onMapChange);
    };
  }, [mapRef, drawPoints, taxiModeActive]);
}
