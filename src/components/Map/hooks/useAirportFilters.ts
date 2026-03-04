import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';
import { ALL_SURFACE_TYPES, type AirportFilterState, useMapStore } from '@/stores/mapStore';
import type { MapRef } from './useMapSetup';

/** All airport layer IDs that need filter application */
const AIRPORT_LAYER_IDS = [
  'airports-custom',
  'airports-glow',
  'airports',
  'airport-labels',
  'airports-hitbox',
] as const;

type FilterExpr = ExpressionSpecification;

/**
 * Build a list of MapLibre expression filter conditions from AirportFilterState.
 * Returns empty array when everything should be hidden (all types unchecked).
 * Returns undefined when no user filtering is needed (all defaults).
 */
function buildConditions(filters: AirportFilterState): FilterExpr[] | undefined {
  const conditions: FilterExpr[] = [];

  // Type filters
  const allowedTypes: string[] = [];
  if (filters.showLand) allowedTypes.push('land');
  if (filters.showSeaplane) allowedTypes.push('seaplane');
  if (filters.showHeliport) allowedTypes.push('heliport');

  if (allowedTypes.length === 0) {
    return []; // hide everything
  }
  if (allowedTypes.length < 3) {
    conditions.push(['in', ['get', 'type'], ['literal', allowedTypes]]);
  }

  // Custom-only filter
  if (filters.onlyCustom) {
    conditions.push(['==', ['get', 'isCustom'], 1]);
  }

  // Surface type filter
  if (filters.surfaceTypes.length === 0) {
    return []; // hide everything
  }
  if (filters.surfaceTypes.length < ALL_SURFACE_TYPES.length) {
    conditions.push(['in', ['get', 'surfaceType'], ['literal', filters.surfaceTypes]]);
  }

  // Country filter
  if (filters.country !== 'all') {
    conditions.push(['==', ['get', 'country'], filters.country]);
  }

  if (conditions.length === 0) return undefined;
  return conditions;
}

/**
 * Apply filter to a single layer, combining base isCustom split with user conditions.
 */
function setLayerFilter(
  map: maplibregl.Map,
  layerId: string,
  conditions: FilterExpr[] | undefined
): void {
  if (!map.getLayer(layerId)) return;

  // Base filter: some layers split on isCustom
  let baseFilter: FilterExpr | undefined;
  if (layerId === 'airports-custom') {
    baseFilter = ['==', ['get', 'isCustom'], 1];
  } else if (layerId === 'airports' || layerId === 'airports-glow') {
    baseFilter = ['==', ['get', 'isCustom'], 0];
  }

  let combined: maplibregl.FilterSpecification | null;

  if (conditions !== undefined && conditions.length === 0) {
    // Hide everything
    combined = ['==', ['get', 'icao'], '__never_match__'];
  } else if (conditions !== undefined) {
    // When onlyCustom is active its condition is ['==', isCustom, 1].
    // On layers whose base is isCustom===0 this creates a contradiction
    // and hides them — which is exactly what we want.
    const parts: FilterExpr[] = [];
    if (baseFilter) parts.push(baseFilter);
    parts.push(...conditions);
    combined =
      parts.length === 1
        ? (parts[0] as maplibregl.FilterSpecification)
        : (['all', ...parts] as maplibregl.FilterSpecification);
  } else if (baseFilter) {
    combined = baseFilter as maplibregl.FilterSpecification;
  } else {
    combined = null;
  }

  map.setFilter(layerId, combined);
}

/**
 * Apply current airport filters from the store to all airport layers.
 * Reads state directly from the store (no stale closures).
 */
function applyCurrentFilters(mapRef: MapRef): void {
  const map = mapRef.current;
  if (!map || !map.getLayer('airports')) return;

  const { airportFilters } = useMapStore.getState();
  const conditions = buildConditions(airportFilters);

  for (const layerId of AIRPORT_LAYER_IDS) {
    setLayerFilter(map, layerId, conditions);
  }
}

/**
 * Hook that applies airport filters to all airport layers via map.setFilter().
 *
 * Uses a direct Zustand store subscription (fires synchronously on state change)
 * instead of React effect deps to avoid batching / reference-equality issues.
 */
export function useAirportFilters(mapRef: MapRef) {
  const styleVersion = useMapStore((s) => s.styleVersion);

  useEffect(() => {
    // 1. Apply for current state (layers may already exist after style change)
    applyCurrentFilters(mapRef);

    // 2. Also apply after initial map load (layers don't exist yet on first mount)
    const map = mapRef.current;
    const onLoad = () => applyCurrentFilters(mapRef);
    if (map && !map.loaded()) {
      map.once('load', onLoad);
    }

    // 3. Subscribe to store — fires synchronously on every filter change
    const unsub = useMapStore.subscribe((state, prevState) => {
      if (state.airportFilters !== prevState.airportFilters) {
        applyCurrentFilters(mapRef);
      }
    });

    return () => {
      unsub();
      map?.off('load', onLoad);
    };
  }, [mapRef, styleVersion]);
}

/** Check if filters differ from defaults */
export function isAirportFiltersActive(filters: AirportFilterState): boolean {
  return (
    !filters.showLand ||
    !filters.showSeaplane ||
    !filters.showHeliport ||
    filters.onlyCustom ||
    filters.surfaceTypes.length < ALL_SURFACE_TYPES.length ||
    filters.country !== 'all'
  );
}
