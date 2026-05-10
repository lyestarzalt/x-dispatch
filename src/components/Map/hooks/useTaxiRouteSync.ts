/**
 * Taxi route lifecycle + interaction. Rendering is delegated to
 * `TaxiRouteLayer` (native MapLibre layers). This hook owns:
 *   - building the taxi graph from the active airport
 *   - mounting / unmounting the route layer
 *   - syncing route + preview + endpoints + drag-handle data into the layer's
 *     GeoJSON sources whenever the store or interaction state changes
 *   - the click / hover / drag-to-reroute mouse handlers on the map
 *
 * Two route modes:
 *   - network: clicks snap to taxi network nodes; the path is filled in by A*
 *   - freehand: clicks place arbitrary waypoints connected directly
 */
import { useEffect, useMemo, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import {
  type EndpointDef,
  type RoutePoint,
  addTaxiRouteLayer,
  removeTaxiRouteLayer,
  setTaxiRoute,
  setTaxiRouteEndpoints,
  setTaxiRouteHandle,
  setTaxiRoutePreview,
} from '@/components/Map/layers/dynamic/TaxiRouteLayer';
import { buildTaxiGraph, findNearestNode } from '@/lib/taxiGraph';
import type { TaxiGraph } from '@/lib/taxiGraph';
import { useAppStore } from '@/stores/appStore';
import { resolveFullPath, useTaxiModeActive, useTaxiRouteStore } from '@/stores/taxiRouteStore';
import type { MapRef } from './useMapSetup';

/** Pixel radius for detecting hover near route line. */
const HIT_TOLERANCE = 18;
/** Pixel radius for detecting hover on an existing anchor. */
const ANCHOR_HIT = 12;

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

function resolveNetworkPoints(nodeIds: number[], graph: TaxiGraph | null): RoutePoint[] {
  if (!graph) return [];
  const points: RoutePoint[] = [];
  for (const id of nodeIds) {
    const node = graph.nodes.get(id);
    if (node) points.push({ longitude: node.lon, latitude: node.lat });
  }
  return points;
}

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
  }>({
    isDragging: false,
    dragType: 'line',
    dragAnchorIndex: -1,
    dragSegIndex: -1,
    previewNodeId: null,
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
  const drawPoints = useMemo<RoutePoint[]>(
    () => (mode === 'network' ? resolveNetworkPoints(networkNodeIds, graph) : waypoints),
    [mode, networkNodeIds, graph, waypoints]
  );

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
        setTaxiRoute(map, []);
        setTaxiRouteEndpoints(map, []);
        setTaxiRoutePreview(map, null);
        setTaxiRouteHandle(map, null);
        return;
      }
      setTaxiRoute(map, drawPoints);
      setTaxiRouteEndpoints(map, buildEndpoints(drawPoints));
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
      if (interactionRef.current.isDragging) return;

      const { mode: currentMode, graph: currentGraph } = useTaxiRouteStore.getState();
      if (currentMode === 'network' && currentGraph) {
        const nearest = findNearestNode(currentGraph, e.lngLat.lng, e.lngLat.lat);
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

    const projectAnchors = (g: TaxiGraph, clicked: number[]): { pt: Pt; anchorIdx: number }[] => {
      const result: { pt: Pt; anchorIdx: number }[] = [];
      for (let i = 0; i < clicked.length; i++) {
        const node = g.nodes.get(clicked[i]!);
        if (node) result.push({ pt: map.project([node.lon, node.lat]), anchorIdx: i });
      }
      return result;
    };

    const buildPreview = (
      inter: typeof interactionRef.current,
      g: TaxiGraph,
      clicked: number[]
    ): RoutePoint[] | null => {
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
      const pts: RoutePoint[] = [];
      for (const id of nodeIds) {
        const node = g.nodes.get(id);
        if (node) pts.push({ longitude: node.lon, latitude: node.lat });
      }
      return pts.length >= 2 ? pts : null;
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
        mapCanvas.style.cursor = '';
        return;
      }

      const cursor = map.project(e.lngLat.toArray() as [number, number]);

      if (inter.isDragging) {
        const nearest = findNearestNode(g, e.lngLat.lng, e.lngLat.lat, true);
        if (nearest) {
          inter.previewNodeId = nearest.id;
          const node = g.nodes.get(nearest.id);
          if (node) {
            setTaxiRouteHandle(map, {
              longitude: node.lon,
              latitude: node.lat,
              grabbed: true,
            });
          }
          setTaxiRoutePreview(map, buildPreview(inter, g, clicked));
        }
        return;
      }

      // Not dragging — pick the closest target (anchor first, then line).
      const anchors = projectAnchors(g, clicked);
      for (const { pt, anchorIdx } of anchors) {
        const d = Math.hypot(pt.x - cursor.x, pt.y - cursor.y);
        if (d < ANCHOR_HIT) {
          const node = g.nodes.get(clicked[anchorIdx]!);
          if (node) {
            setTaxiRouteHandle(map, {
              longitude: node.lon,
              latitude: node.lat,
              grabbed: false,
            });
          }
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
      setTaxiRoutePreview(map, null);
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

      inter.isDragging = false;
      inter.previewNodeId = null;
      setTaxiRoutePreview(map, null);
      setTaxiRouteHandle(map, null);
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
}
