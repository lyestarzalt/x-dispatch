import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';
import { ALL_SURFACE_TYPES, type AirportFilterState, useMapStore } from '@/stores/mapStore';
import { AIRPORT_LAYER_BASE_FILTERS } from '../layers/world/AirportsLayer';
import type { MapRef } from './useMapSetup';

/** Every airport layer, in the order the layer file adds them. */
export const AIRPORT_FILTERABLE_LAYER_IDS: readonly string[] = Object.keys(
  AIRPORT_LAYER_BASE_FILTERS
);

type FilterExpr = ExpressionSpecification;

const NEVER_MATCH: maplibregl.FilterSpecification = ['==', ['get', 'icao'], '__never_match__'];

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
 * The complete filter for one airport layer: its own base filter from the
 * layer file ANDed with the user's conditions. `null` clears the filter.
 */
export function buildAirportLayerFilter(
  layerId: string,
  filters: AirportFilterState
): maplibregl.FilterSpecification | null {
  const base = AIRPORT_LAYER_BASE_FILTERS[layerId];
  const conditions = buildConditions(filters);

  if (conditions !== undefined && conditions.length === 0) return NEVER_MATCH;
  if (conditions === undefined) return base ?? null;

  // When onlyCustom is active its condition contradicts the isCustom===0
  // base of the default layers and hides them, which is the intent.
  const parts: FilterExpr[] = [];
  if (base) parts.push(base as FilterExpr);
  parts.push(...conditions);
  return parts.length === 1
    ? (parts[0] as maplibregl.FilterSpecification)
    : (['all', ...parts] as maplibregl.FilterSpecification);
}

/**
 * Apply current airport filters from the store to all airport layers.
 * Reads state directly from the store (no stale closures).
 */
function applyCurrentFilters(mapRef: MapRef): void {
  const map = mapRef.current;
  if (!map || !map.getLayer('airports')) return;

  const { airportFilters } = useMapStore.getState();

  for (const layerId of AIRPORT_FILTERABLE_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue;
    map.setFilter(layerId, buildAirportLayerFilter(layerId, airportFilters));
  }
}

/**
 * Hook that applies airport filters to all airport layers via map.setFilter().
 *
 * Uses a direct Zustand store subscription (fires synchronously on state change)
 * instead of React effect deps to avoid batching / reference-equality issues.
 */
export function useAirportFilters(mapRef: MapRef) {
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
  }, [mapRef]);
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
