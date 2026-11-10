/**
 * Taxi route lifecycle + interaction. Rendering is delegated to
 * `TaxiRouteLayer` (native MapLibre layers). This hook owns:
 *   - showing the planned guidance routes while none is being edited, the
 *     one the aircraft is on trimmed to what is still ahead, plus their
 *     hold-short bars
 *   - building the taxi graph from the active airport
 *   - mounting / unmounting the route layer
 *   - syncing route + preview + endpoints + drag-handle data into the layer's
 *     GeoJSON sources whenever the store or interaction state changes
 *   - the click / hover / drag-to-reroute mouse handlers on the map
 *
 * Two route modes:
 *   - network: clicks snap to taxi network nodes; the router fills in the path
 *   - freehand: clicks place arbitrary waypoints connected directly
 */
import { useEffect, useMemo, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import {
  type EndpointDef,
  type RoutePoint,
  addTaxiRouteLayer,
  bringTaxiRouteToFront,
  removeTaxiRouteLayer,
  setTaxiRoute,
  setTaxiRouteDimmed,
  setTaxiRouteEndpoints,
  setTaxiRouteHandle,
  setTaxiRouteHoldBars,
  setTaxiRouteLines,
  setTaxiRoutePreview,
} from '@/components/Map/layers/dynamic/TaxiRouteLayer';
import { buildTaxiGraph, findNearestEdge, findNearestNode } from '@/lib/taxiGraph';
import type { EdgeSnap, TaxiGraph } from '@/lib/taxiGraph';
import { type GuidancePoint, createGuidanceTracker, prepareRoute } from '@/lib/taxiGuidance';
import { useAppStore } from '@/stores/appStore';
import { usePlaneStore } from '@/stores/planeStore';
import { guidanceRoutes, useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';
import {
  linkMeets,
  resolvePath,
  useTaxiModeActive,
  useTaxiRouteStore,
} from '@/stores/taxiRouteStore';
import type { MapRef } from './useMapSetup';

/** Pixel radius for detecting hover near route line. */
const HIT_TOLERANCE = 18;
/** Pixel radius for detecting hover on an existing anchor; at least the line's, so an end is never taken for a line grab. */
const ANCHOR_HIT = 18;
/** Metres a taxiway touching the route may be farther from the cursor than another and still take a dragged end. */
const ROUTE_SNAP_BIAS_M = 15;

interface Pt {
  x: number;
  y: number;
}

/** Distance from point P to line segment AB; also returns clamped t in [0,1]. */
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

/**
 * Where a drag snaps. A dragged end prefers the taxiways its route is on and
 * the ones leading off them, so stepping it back a node does not land on a
 * parallel taxiway nearby; a via point goes anywhere.
 */
function snapForDrag(
  graph: TaxiGraph,
  routeIds: number[],
  endDrag: boolean,
  lng: number,
  lat: number
): EdgeSnap | null {
  const any = findNearestEdge(graph, lng, lat);
  if (!endDrag || !any) return any;
  const near = new Set(routeIds);
  for (const id of routeIds) {
    for (const e of graph.adjacency.get(id) ?? []) near.add(e.toNodeId);
  }
  const onRoute = findNearestEdge(graph, lng, lat, (id) => near.has(id));
  return onRoute && onRoute.distance <= any.distance + ROUTE_SNAP_BIAS_M ? onRoute : any;
}

function resolveNetworkPoints(nodeIds: number[], graph: TaxiGraph | null): RoutePoint[] {
  if (!graph) return [];
  const points: RoutePoint[] = [];
  for (const id of nodeIds) {
    const node = graph.nodes.get(id);
    if (node) points.push({ longitude: node.lon, latitude: node.lat });
  }
  return points;
}

function toRoutePoints(points: GuidancePoint[]): RoutePoint[] {
  return points.map((p) => ({ longitude: p.lon, latitude: p.lat }));
}

/** Redraw the trimmed route only once the aircraft has moved this far along it. */
const TRIM_STEP_M = 5;

function buildEndpoints(points: RoutePoint[]): EndpointDef[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const only = points[0]!;
    return [{ longitude: only.longitude, latitude: only.latitude, kind: 'start' }];
  }
  const start = points[0]!;
  const end = points[points.length - 1]!;
  return [
    { longitude: start.longitude, latitude: start.latitude, kind: 'start' },
    { longitude: end.longitude, latitude: end.latitude, kind: 'end' },
  ];
}

export function useTaxiRouteSync(mapRef: MapRef): void {
  const mode = useTaxiRouteStore((s) => s.mode);
  const waypoints = useTaxiRouteStore((s) => s.waypoints);
  const networkNodeIds = useTaxiRouteStore((s) => s.networkNodeIds);
  const standLink = useTaxiRouteStore((s) => s.standLink);
  const graph = useTaxiRouteStore((s) => s.graph);
  const taxiModeActive = useTaxiModeActive();
  const clickModeEnabled = useTaxiRouteStore((s) => s.clickModeEnabled);
  const addWaypoint = useTaxiRouteStore((s) => s.addWaypoint);
  const addNetworkNode = useTaxiRouteStore((s) => s.addNetworkNode);
  const setGraph = useTaxiRouteStore((s) => s.setGraph);

  // Drag/hover state — mutated directly, no rerenders.
  const interactionRef = useRef<{
    isDragging: boolean;
    /** 'anchor' = moving an existing anchor, 'line' = inserting a new via-point */
    dragType: 'anchor' | 'line';
    /** Index into clickedNodeIds when dragging an anchor */
    dragAnchorIndex: number;
    /** Segment index in the line for insertion */
    dragSegIndex: number;
    previewNodeId: number | null;
    /** Whether the previewed route has a way through every leg; a drop is kept only then. */
    previewComplete: boolean;
  }>({
    isDragging: false,
    dragType: 'line',
    dragAnchorIndex: -1,
    dragSegIndex: -1,
    previewNodeId: null,
    previewComplete: false,
  });

  // Build the taxi graph when the active airport's network changes.
  const taxiNetwork = useAppStore((s) => s.selectedAirportData?.taxiNetwork);
  useEffect(() => {
    if (taxiNetwork && taxiNetwork.nodes.length > 0 && taxiNetwork.edges.length > 0) {
      setGraph(buildTaxiGraph(taxiNetwork));
    } else {
      setGraph(null);
    }
  }, [taxiNetwork, setGraph]);

  // Resolve the active route's geographic points based on the current mode.
  // useMemo so the reference is stable across renders that don't change inputs.
  const drawPoints = useMemo<RoutePoint[]>(() => {
    if (mode !== 'network') return waypoints;
    const points = resolveNetworkPoints(networkNodeIds, graph);
    if (points.length === 0) return points;
    const { from, to } = standLink;
    return [
      ...(from ? [{ longitude: from.lon, latitude: from.lat }] : []),
      ...points,
      ...(to ? [{ longitude: to.lon, latitude: to.lat }] : []),
    ];
  }, [mode, networkNodeIds, graph, waypoints, standLink]);

  // ──────────────────────────────────────────────────────────────────────
  // Layer lifecycle + sync
  //
  // Combined into one effect because pushing data into a source that
  // doesn't exist yet is silently dropped, and `addTaxiRouteLayer` is
  // idempotent. If the style isn't loaded on first run, we wait for the
  // `load` event and re-run with the current closure (so the latest
  // `drawPoints` lands). Basemap changes are handled at the map-setup
  // level via `transformStyle`, so our layer survives them and we don't
  // need to re-add on style.load.
  //
  // Layer removal is in a separate unmount-only effect to avoid churning
  // the layer on every `drawPoints` change.
  // ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      addTaxiRouteLayer(map);
      if (!taxiModeActive) {
        // The guidance effect below owns the route line while nothing is edited.
        setTaxiRoutePreview(map, null);
        setTaxiRouteHandle(map, null);
        return;
      }
      setTaxiRoute(map, drawPoints);
      setTaxiRouteEndpoints(map, buildEndpoints(drawPoints));
      // The route layers mount on `load` (before any airport renders), so
      // when the user selects an airport its 16 layers get appended on top
      // of the route. Re-lift here whenever the route data changes — the
      // user has just made a meaningful change, and `moveLayer` is cheap.
      bringTaxiRouteToFront(map);
    };

    apply();
    // `load` fires once when the initial style is ready; `style.load` fires
    // after every basemap change. Listening to both means the layer is
    // (re)added and the data is (re)pushed after either event, regardless
    // of the order in which the hook mounts vs. the map finishes loading.
    map.on('load', apply);
    map.on('style.load', apply);
    return () => {
      map.off('load', apply);
      map.off('style.load', apply);
    };
  }, [mapRef, drawPoints, taxiModeActive]);

  // ──────────────────────────────────────────────────────────────────────
  // Guidance routes: hold bars always; while nothing is being edited, the
  // planned routes themselves, the one the aircraft is on trimmed behind it.
  // Follows the aircraft through a store subscription so the map component
  // doesn't re-render at the position-stream rate.
  // ──────────────────────────────────────────────────────────────────────

  const departureRoute = useTaxiGuidanceStore((s) => s.departure);
  const arrivalRoute = useTaxiGuidanceStore((s) => s.arrival);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routes = guidanceRoutes({ departure: departureRoute, arrival: arrivalRoute });
    const holdBars = routes.flatMap((r) => prepareRoute(r).holdBars.map(toRoutePoints));
    const endpoints = routes.flatMap((r) => buildEndpoints(toRoutePoints(prepareRoute(r).drawn)));
    const tracker = createGuidanceTracker();
    let lastStep: string | null = null;

    const draw = (force: boolean) => {
      // Nothing to show behind X-Plane; `visibilitychange` redraws on the way back.
      if (taxiModeActive || document.hidden) return;
      const plane = usePlaneStore.getState().state;
      const tracked = tracker.update(
        routes,
        plane ? { lat: plane.latitude, lon: plane.longitude } : null
      );
      const step = tracked
        ? `${tracked.route.direction}:${Math.round(tracked.progress.along / TRIM_STEP_M)}`
        : '';
      if (!force && step === lastStep) return;
      lastStep = step;
      setTaxiRouteLines(
        map,
        routes.map((r) =>
          toRoutePoints(tracked?.route === r ? tracked.remaining : prepareRoute(r).drawn)
        )
      );
    };

    const apply = () => {
      addTaxiRouteLayer(map);
      setTaxiRouteHoldBars(map, holdBars);
      if (!taxiModeActive) setTaxiRouteEndpoints(map, endpoints);
      draw(true);
      bringTaxiRouteToFront(map);
    };

    apply();
    map.on('load', apply);
    map.on('style.load', apply);
    const unsubscribe = usePlaneStore.subscribe(() => draw(false));
    const onVisible = () => draw(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      map.off('load', apply);
      map.off('style.load', apply);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [mapRef, departureRoute, arrivalRoute, taxiModeActive]);

  // Remove the layer only when the hook unmounts (or `mapRef` changes).
  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map && map.getStyle()) removeTaxiRouteLayer(map);
    };
  }, [mapRef]);

  // ──────────────────────────────────────────────────────────────────────
  // Click handler — add waypoint or snap to nearest network node
  // ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !taxiModeActive || !clickModeEnabled) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      // Suppress click that immediately follows a drag.
      const inter = interactionRef.current;
      if (inter.isDragging) return;
      // A click on a picked point is the start of a double-click to remove it, not a new point.
      if (inter.dragType === 'anchor' && inter.dragAnchorIndex >= 0) return;

      const { mode: currentMode, graph: currentGraph } = useTaxiRouteStore.getState();
      if (currentMode === 'network' && currentGraph) {
        const nearest = findNearestNode(currentGraph, e.lngLat.lng, e.lngLat.lat, true);
        if (nearest) addNetworkNode(nearest.id);
      } else {
        addWaypoint(e.lngLat.lng, e.lngLat.lat);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapRef, taxiModeActive, clickModeEnabled, addWaypoint, addNetworkNode]);

  // ──────────────────────────────────────────────────────────────────────
  // Hover + drag-to-reroute interaction
  // ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance || !taxiModeActive) return;

    const map = mapInstance;
    const mapCanvas = map.getCanvas();

    /** Grabbable spots: the picked nodes, and the stand points, which move the end they hang off. */
    const projectAnchors = (
      g: TaxiGraph,
      clicked: number[]
    ): { pt: Pt; anchorIdx: number; lon: number; lat: number }[] => {
      const result: { pt: Pt; anchorIdx: number; lon: number; lat: number }[] = [];
      const add = (p: { lon: number; lat: number } | null | undefined, anchorIdx: number) => {
        if (p) result.push({ pt: map.project([p.lon, p.lat]), anchorIdx, lon: p.lon, lat: p.lat });
      };
      const { standLink } = useTaxiRouteStore.getState();
      add(standLink.from, 0);
      add(standLink.to, clicked.length - 1);
      for (let i = 0; i < clicked.length; i++) add(g.nodes.get(clicked[i]!), i);
      return result;
    };

    const buildPreview = (
      inter: typeof interactionRef.current,
      g: TaxiGraph,
      clicked: number[]
    ): { points: RoutePoint[]; complete: boolean } | null => {
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

      const { sizeCode, standLink } = useTaxiRouteStore.getState();
      const { nodeIds, complete, doublesBack } = resolvePath(hypothetical, g, sizeCode);
      // A route that already taxis a stretch both ways stays editable, or it could never be fixed.
      const blocked = doublesBack && !resolvePath(clicked, g, sizeCode).doublesBack;
      const pts: RoutePoint[] = [];
      // The stand ends stay unless the drag moves that end off the stand's taxiway.
      const moved = (idx: number) => inter.dragType === 'anchor' && inter.dragAnchorIndex === idx;
      const keepFrom = !moved(0) || linkMeets(g, standLink.from, inter.previewNodeId);
      const keepTo = !moved(clicked.length - 1) || linkMeets(g, standLink.to, inter.previewNodeId);
      if (keepFrom && standLink.from) {
        pts.push({ longitude: standLink.from.lon, latitude: standLink.from.lat });
      }
      for (const id of nodeIds) {
        const node = g.nodes.get(id);
        if (node) pts.push({ longitude: node.lon, latitude: node.lat });
      }
      if (keepTo && standLink.to) {
        pts.push({ longitude: standLink.to.lon, latitude: standLink.to.lat });
      }
      // A drag that would send the route out and back is shown but never kept.
      return pts.length >= 2 ? { points: pts, complete: complete && !blocked } : null;
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      const inter = interactionRef.current;
      const {
        mode: m,
        graph: g,
        networkNodeIds: ids,
        clickedNodeIds: clicked,
      } = useTaxiRouteStore.getState();

      if (m !== 'network' || !g || ids.length < 2) {
        setTaxiRouteHandle(map, null);
        inter.dragType = 'line';
        inter.dragAnchorIndex = -1;
        inter.dragSegIndex = -1;
        mapCanvas.style.cursor = '';
        return;
      }

      const cursor = map.project(e.lngLat.toArray() as [number, number]);

      if (inter.isDragging) {
        // Slide along the taxiway centreline under the cursor; the drop takes the nearer node.
        const endDrag =
          inter.dragType === 'anchor' &&
          (inter.dragAnchorIndex === 0 || inter.dragAnchorIndex === clicked.length - 1);
        const snap = snapForDrag(g, ids, endDrag, e.lngLat.lng, e.lngLat.lat);
        if (snap) {
          setTaxiRouteHandle(map, {
            longitude: snap.lon,
            latitude: snap.lat,
            grabbed: true,
            name: snap.name,
          });
          if (snap.nodeId !== inter.previewNodeId) {
            inter.previewNodeId = snap.nodeId;
            const preview = buildPreview(inter, g, clicked);
            inter.previewComplete = preview?.complete ?? false;
            setTaxiRoutePreview(map, preview?.points ?? null, !inter.previewComplete);
          }
        }
        return;
      }

      // Not dragging — pick the closest target (anchor first, then line).
      const anchors = projectAnchors(g, clicked);
      for (const { pt, anchorIdx, lon, lat } of anchors) {
        const d = Math.hypot(pt.x - cursor.x, pt.y - cursor.y);
        if (d < ANCHOR_HIT) {
          setTaxiRouteHandle(map, { longitude: lon, latitude: lat, grabbed: false });
          inter.dragType = 'anchor';
          inter.dragAnchorIndex = anchorIdx;
          inter.dragSegIndex = -1;
          mapCanvas.style.cursor = 'grab';
          return;
        }
      }

      const linePts: Pt[] = [];
      for (const id of ids) {
        const node = g.nodes.get(id);
        if (node) linePts.push(map.project([node.lon, node.lat]));
      }
      const closest = findClosestOnLine(linePts, cursor);
      if (closest && closest.dist < HIT_TOLERANCE) {
        const lngLat = map.unproject([closest.point.x, closest.point.y]);
        setTaxiRouteHandle(map, {
          longitude: lngLat.lng,
          latitude: lngLat.lat,
          grabbed: false,
        });
        inter.dragType = 'line';
        inter.dragAnchorIndex = -1;
        const store = useTaxiRouteStore.getState();
        inter.dragSegIndex = store.findAnchorSegment(closest.segIndex);
        mapCanvas.style.cursor = 'grab';
      } else {
        setTaxiRouteHandle(map, null);
        inter.dragType = 'line';
        inter.dragAnchorIndex = -1;
        inter.dragSegIndex = -1;
        mapCanvas.style.cursor = '';
      }
    };

    const handleMouseDown = (e: maplibregl.MapMouseEvent) => {
      const inter = interactionRef.current;
      if (inter.dragType === 'anchor' && inter.dragAnchorIndex < 0) return;
      if (inter.dragType === 'line' && inter.dragSegIndex < 0) return;
      // Only start a drag if we're already showing a handle.
      const handleVisible = mapCanvas.style.cursor === 'grab';
      if (!handleVisible) return;

      e.preventDefault();
      inter.isDragging = true;
      inter.previewNodeId = null;
      inter.previewComplete = false;
      setTaxiRoutePreview(map, null);
      setTaxiRouteDimmed(map, true);
      map.dragPan.disable();
      mapCanvas.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
      const inter = interactionRef.current;
      if (!inter.isDragging) return;

      const nodeId = inter.previewNodeId;
      const complete = inter.previewComplete;
      const dragType = inter.dragType;
      const anchorIdx = inter.dragAnchorIndex;
      const segIdx = inter.dragSegIndex;

      inter.isDragging = false;
      inter.previewNodeId = null;
      inter.previewComplete = false;
      setTaxiRoutePreview(map, null);
      setTaxiRouteHandle(map, null);
      setTaxiRouteDimmed(map, false);
      map.dragPan.enable();
      mapCanvas.style.cursor = '';

      // A drop with no way through leaves the route as it was.
      if (nodeId == null || !complete) return;

      const store = useTaxiRouteStore.getState();
      if (dragType === 'anchor' && anchorIdx >= 0) {
        store.replaceNetworkNode(anchorIdx, nodeId);
      } else if (dragType === 'line' && segIdx >= 0) {
        store.insertViaNode(segIdx, nodeId);
      }
    };

    // Double-click a via-point to drop it. Captured ahead of MapLibre so the map does not zoom.
    const container = map.getContainer();
    const handleDblClick = (e: MouseEvent) => {
      const inter = interactionRef.current;
      const { clickedNodeIds: clicked, removeViaNode } = useTaxiRouteStore.getState();
      const idx = inter.dragType === 'anchor' ? inter.dragAnchorIndex : -1;
      if (idx <= 0 || idx >= clicked.length - 1) return;
      e.preventDefault();
      e.stopPropagation();
      removeViaNode(idx);
      inter.dragAnchorIndex = -1;
      setTaxiRouteHandle(map, null);
      mapCanvas.style.cursor = '';
    };

    map.on('mousemove', handleMouseMove);
    map.on('mousedown', handleMouseDown);
    map.on('mouseup', handleMouseUp);
    container.addEventListener('dblclick', handleDblClick, true);

    const interSnap = interactionRef.current;
    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mousedown', handleMouseDown);
      map.off('mouseup', handleMouseUp);
      container.removeEventListener('dblclick', handleDblClick, true);
      if (interSnap.isDragging) {
        interSnap.isDragging = false;
        setTaxiRouteDimmed(map, false);
        map.dragPan.enable();
        mapCanvas.style.cursor = '';
      }
    };
  }, [mapRef, taxiModeActive]);
}
