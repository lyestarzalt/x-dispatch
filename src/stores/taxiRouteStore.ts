/**
 * Taxi Route Store
 * Manages taxi route state for airport ground navigation.
 *
 * Two modes:
 * - network: clicks snap to taxi network nodes, A* pathfinds between them
 * - freehand: arbitrary clicks on the map (legacy behavior)
 */
import { create } from 'zustand';
import type { PathResult, TaxiGraph } from '@/lib/taxiGraph';
import { findNearestNode, findPath } from '@/lib/taxiGraph';

// ============================================================================
// Types
// ============================================================================

export interface TaxiRoutePoint {
  longitude: number;
  latitude: number;
}

export type TaxiRouteMode = 'network' | 'freehand';

interface TaxiRouteState {
  mode: TaxiRouteMode;

  // --- Freehand mode state ---
  waypoints: TaxiRoutePoint[];

  // --- Network mode state ---
  /** The user-clicked node IDs (anchors for re-routing) */
  clickedNodeIds: number[];
  /** The full resolved path as node IDs (includes intermediate A* nodes) */
  networkNodeIds: number[];
  /** Prebuilt graph for the active airport */
  graph: TaxiGraph | null;
  /** Last A* result for route summary (taxiway names, distance) */
  autoRouteResult: PathResult | null;
  /** Currently selected runway end name (e.g. "25R") */
  selectedRunway: string | null;

  // --- Shared state ---
  activeTaxiIcao: string | null;
  clickModeEnabled: boolean;

  // Actions
  setMode: (mode: TaxiRouteMode) => void;
  setGraph: (graph: TaxiGraph | null) => void;
  setActiveAirport: (icao: string) => void;
  addWaypoint: (lon: number, lat: number) => void;
  addNetworkNode: (nodeId: number) => void;
  /** Auto-route from a gate position to a runway end position */
  computeAutoRoute: (
    gateLon: number,
    gateLat: number,
    runwayLon: number,
    runwayLat: number,
    runwayName: string
  ) => void;
  /** Replace a clicked anchor node at the given index with a new node, re-route */
  replaceNetworkNode: (anchorIndex: number, newNodeId: number) => void;
  /** Find which anchor segment a network node index falls in */
  findAnchorSegment: (networkIndex: number) => number;
  /** Insert a via-point by splitting a segment */
  insertViaNode: (afterAnchorIndex: number, nodeId: number) => void;
  removeLastWaypoint: () => void;
  removeLastNetworkNode: () => void;
  clearRoute: () => void;
  deactivate: () => void;
  setClickModeEnabled: (enabled: boolean) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Rebuild the full networkNodeIds from clickedNodeIds by running A*
 * between each consecutive pair. Exported for preview computation.
 */
export function resolveFullPath(clickedIds: number[], graph: TaxiGraph | null): number[] {
  if (!graph || clickedIds.length === 0) return [];
  if (clickedIds.length === 1) return [clickedIds[0]!];

  const full: number[] = [];
  for (let i = 0; i < clickedIds.length - 1; i++) {
    const result = findPath(graph, clickedIds[i]!, clickedIds[i + 1]!);
    if (!result) {
      // No path between these nodes — just connect directly
      if (full.length === 0) full.push(clickedIds[i]!);
      full.push(clickedIds[i + 1]!);
    } else {
      // Avoid duplicating the junction node
      const segment = i === 0 ? result.nodeIds : result.nodeIds.slice(1);
      full.push(...segment);
    }
  }

  // Remove backtracking loops — if any node appears twice, the path
  // doubled back on itself. Cut everything between the two occurrences.
  // Example: [A, B, C, D, C, B, E] → [A, B, E]
  // Walk backward from the end to find the LAST occurrence of each node,
  // which gives us the shortest non-looping path.
  const cleaned: number[] = [];
  let i = 0;
  while (i < full.length) {
    const nodeId = full[i]!;
    // Look ahead: does this node appear again later?
    let lastIdx = i;
    for (let j = i + 1; j < full.length; j++) {
      if (full[j] === nodeId) lastIdx = j;
    }
    cleaned.push(nodeId);
    i = lastIdx + 1; // skip to after the last occurrence
  }

  return cleaned;
}

// ============================================================================
// Store
// ============================================================================

export const useTaxiRouteStore = create<TaxiRouteState>()((set, get) => ({
  mode: 'network',
  waypoints: [],
  clickedNodeIds: [],
  networkNodeIds: [],
  graph: null,
  autoRouteResult: null,
  selectedRunway: null,
  activeTaxiIcao: null,
  clickModeEnabled: false,

  setMode: (mode) =>
    set({ mode, waypoints: [], clickedNodeIds: [], networkNodeIds: [], autoRouteResult: null }),

  setGraph: (graph) => set({ graph }),

  setActiveAirport: (icao) =>
    set({
      activeTaxiIcao: icao.toUpperCase(),
      waypoints: [],
      clickedNodeIds: [],
      networkNodeIds: [],
      clickModeEnabled: true,
    }),

  addWaypoint: (lon, lat) =>
    set((state) => ({
      waypoints: [...state.waypoints, { longitude: lon, latitude: lat }],
    })),

  addNetworkNode: (nodeId) => {
    const { clickedNodeIds, graph } = get();
    const newClicked = [...clickedNodeIds, nodeId];
    set({
      clickedNodeIds: newClicked,
      networkNodeIds: resolveFullPath(newClicked, graph),
    });
  },

  computeAutoRoute: (gateLon, gateLat, runwayLon, runwayLat, runwayName) => {
    const { graph } = get();
    if (!graph) return;

    const gateNode = findNearestNode(graph, gateLon, gateLat, true);
    const runwayNode = findNearestNode(graph, runwayLon, runwayLat, true);
    if (!gateNode || !runwayNode) return;

    const result = findPath(graph, gateNode.id, runwayNode.id);
    if (result) {
      set({
        mode: 'network',
        clickedNodeIds: [gateNode.id, runwayNode.id],
        networkNodeIds: result.nodeIds,
        autoRouteResult: result,
        selectedRunway: runwayName,
      });
    }
  },

  replaceNetworkNode: (anchorIndex, newNodeId) => {
    const { clickedNodeIds, graph } = get();
    if (anchorIndex < 0 || anchorIndex >= clickedNodeIds.length) return;
    const newClicked = [...clickedNodeIds];
    newClicked[anchorIndex] = newNodeId;
    set({
      clickedNodeIds: newClicked,
      networkNodeIds: resolveFullPath(newClicked, graph),
      autoRouteResult: null, // summary invalidated
    });
  },

  findAnchorSegment: (networkIndex) => {
    const { clickedNodeIds, networkNodeIds } = get();
    if (clickedNodeIds.length < 2) return 0;
    // Walk through networkNodeIds and find which segment this index is in
    // by matching against clickedNodeIds boundaries
    let anchorIdx = 0;
    for (let i = 0; i < networkNodeIds.length && anchorIdx < clickedNodeIds.length - 1; i++) {
      if (networkNodeIds[i] === clickedNodeIds[anchorIdx + 1]) {
        if (i >= networkIndex) return anchorIdx;
        anchorIdx++;
      }
    }
    return Math.max(0, clickedNodeIds.length - 2);
  },

  insertViaNode: (afterAnchorIndex, nodeId) => {
    const { clickedNodeIds, graph } = get();
    if (afterAnchorIndex < 0 || afterAnchorIndex >= clickedNodeIds.length) return;
    const newClicked = [
      ...clickedNodeIds.slice(0, afterAnchorIndex + 1),
      nodeId,
      ...clickedNodeIds.slice(afterAnchorIndex + 1),
    ];
    set({
      clickedNodeIds: newClicked,
      networkNodeIds: resolveFullPath(newClicked, graph),
      autoRouteResult: null,
    });
  },

  removeLastWaypoint: () =>
    set((state) => ({
      waypoints: state.waypoints.length > 0 ? state.waypoints.slice(0, -1) : state.waypoints,
    })),

  removeLastNetworkNode: () => {
    const { clickedNodeIds, graph } = get();
    if (clickedNodeIds.length === 0) return;
    const newClicked = clickedNodeIds.slice(0, -1);
    set({
      clickedNodeIds: newClicked,
      networkNodeIds: resolveFullPath(newClicked, graph),
    });
  },

  clearRoute: () =>
    set({
      waypoints: [],
      clickedNodeIds: [],
      networkNodeIds: [],
      autoRouteResult: null,
      selectedRunway: null,
    }),

  deactivate: () =>
    set({
      activeTaxiIcao: null,
      waypoints: [],
      clickedNodeIds: [],
      networkNodeIds: [],
      autoRouteResult: null,
      selectedRunway: null,
      clickModeEnabled: false,
    }),

  setClickModeEnabled: (enabled) => set({ clickModeEnabled: enabled }),
}));

// ============================================================================
// Derived selectors
// ============================================================================

/** Whether taxi route mode is active. */
export function useTaxiModeActive(): boolean {
  return useTaxiRouteStore((s) => s.activeTaxiIcao !== null);
}
