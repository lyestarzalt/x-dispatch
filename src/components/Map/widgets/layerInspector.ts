import type maplibregl from 'maplibre-gl';

// --- Types ---

export type LayerStatus = 'drawn' | 'hidden' | 'out-of-range' | 'empty' | 'loading' | 'no-source';

export interface SublayerInfo {
  layerId: string;
  name: string;
  sourceId: string;
  status: LayerStatus;
  drawOrder: number;
}

export interface RendererInfo {
  name: string;
  primaryLayerId: string;
  sourceIds: string[];
  status: LayerStatus;
  featureCount: number;
  approximate: boolean;
  zoomRange: [number | null, number | null];
  drawOrder: number;
  sublayers: SublayerInfo[];
}

export interface LayerInspectorGroup {
  category: 'airport' | 'nav' | 'dynamic';
  renderers: RendererInfo[];
  drawnCount: number;
  totalCount: number;
}

// --- Constants ---

const CATEGORY_PREFIXES: { prefix: string; category: 'airport' | 'nav' | 'dynamic' }[] = [
  { prefix: 'airport-', category: 'airport' },
  { prefix: 'nav-', category: 'nav' },
  { prefix: 'vatsim-', category: 'dynamic' },
  { prefix: 'ivao-', category: 'dynamic' },
  { prefix: 'procedure-', category: 'dynamic' },
  { prefix: 'flightplan-', category: 'dynamic' },
  { prefix: 'range-rings-', category: 'dynamic' },
  { prefix: 'route-line', category: 'dynamic' },
  { prefix: 'player-', category: 'dynamic' },
];

// --- Helpers ---

/** Classify a layer ID into a category, or null if it's a base map layer */
function classifyLayer(
  layerId: string
): { category: 'airport' | 'nav' | 'dynamic'; suffix: string } | null {
  for (const { prefix, category } of CATEGORY_PREFIXES) {
    if (layerId.startsWith(prefix)) {
      return { category, suffix: layerId.slice(prefix.length) };
    }
  }
  return null;
}

/** Derive renderer key from layer suffix — first segment before hyphen */
function rendererKey(suffix: string): string {
  const idx = suffix.indexOf('-');
  return idx === -1 ? suffix : suffix.slice(0, idx);
}

/** Get feature count from a source. Prefer _data for GeoJSON, fall back to querySourceFeatures */
function getFeatureCount(map: maplibregl.Map, sourceId: string): number {
  const source = map.getSource(sourceId);
  if (!source) return 0;

  // Try direct GeoJSON data access
  const data = (source as any)._data as GeoJSON.FeatureCollection | undefined;
  if (data?.features) return data.features.length;

  // Fallback: querySourceFeatures (may be approximate due to tiling)
  try {
    return map.querySourceFeatures(sourceId).length;
  } catch {
    return 0;
  }
}

/** Check if feature count came from querySourceFeatures fallback (approximate) */
function isApproximate(map: maplibregl.Map, sourceId: string): boolean {
  const source = map.getSource(sourceId);
  if (!source) return false;
  const data = (source as any)._data as GeoJSON.FeatureCollection | undefined;
  return !data?.features;
}

/** Derive status for a single layer */
function deriveStatus(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
  currentZoom: number
): LayerStatus {
  const source = map.getSource(sourceId);
  if (!source) return 'no-source';
  if (!map.isSourceLoaded(sourceId)) return 'loading';

  const count = getFeatureCount(map, sourceId);
  // Only report empty if we have a reliable count (direct _data access).
  // querySourceFeatures can return 0 for valid sources when tiles aren't loaded.
  if (count === 0 && !isApproximate(map, sourceId)) return 'empty';

  const vis = map.getLayoutProperty(layerId, 'visibility');
  if (vis === 'none') return 'hidden';

  const layer = map.getLayer(layerId);
  if (layer) {
    const minZoom = (layer as any).minzoom ?? 0;
    const maxZoom = (layer as any).maxzoom ?? 24;
    if (currentZoom < minZoom || currentZoom > maxZoom) return 'out-of-range';
  }

  return 'drawn';
}

/** Worst status wins */
const STATUS_PRIORITY: Record<LayerStatus, number> = {
  'no-source': 6,
  loading: 5,
  empty: 4,
  'out-of-range': 3,
  hidden: 2,
  drawn: 1,
};

function worstStatus(statuses: LayerStatus[]): LayerStatus {
  return statuses.reduce(
    (worst, s) => (STATUS_PRIORITY[s] > STATUS_PRIORITY[worst] ? s : worst),
    'drawn' as LayerStatus
  );
}

/** Convert layer suffix to human-readable name: "taxiway-lights" → "Taxiway Lights" */
function humanName(suffix: string): string {
  return suffix
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// --- Main collection function ---

interface LayerEntry {
  layerId: string;
  category: 'airport' | 'nav' | 'dynamic';
  suffix: string;
  key: string;
  sourceId: string;
  drawOrder: number;
}

export function collectLayerInspectorData(map: maplibregl.Map): LayerInspectorGroup[] {
  const layerOrder = map.getLayersOrder();
  const currentZoom = map.getZoom();

  // Step 1: Classify all app layers
  const appLayers: LayerEntry[] = [];
  let appIndex = 0;

  for (const layerId of layerOrder) {
    const cls = classifyLayer(layerId);
    if (!cls) continue;

    const layer = map.getLayer(layerId);
    const sourceId = ((layer as any)?.source as string) ?? '';

    appLayers.push({
      layerId,
      category: cls.category,
      suffix: cls.suffix,
      key: rendererKey(cls.suffix),
      sourceId,
      drawOrder: appIndex++,
    });
  }

  // Step 2: Group by category + renderer key (no source-based splitting)
  const rendererGroups = new Map<string, LayerEntry[]>();
  for (const entry of appLayers) {
    const groupKey = `${entry.category}:${entry.key}`;
    if (!rendererGroups.has(groupKey)) rendererGroups.set(groupKey, []);
    rendererGroups.get(groupKey)!.push(entry);
  }

  // Step 3: Build RendererInfo for each group
  const categoryRenderers = new Map<string, RendererInfo[]>();

  for (const [, entries] of rendererGroups) {
    const first = entries[0];
    if (!first) continue;
    const category = first.category;
    const sorted = entries.sort((a, b) => a.drawOrder - b.drawOrder);
    const primary = sorted[0];
    if (!primary) continue;
    const sublayerEntries = sorted.slice(1);

    const sourceIds = [...new Set(sorted.map((e) => e.sourceId).filter(Boolean))];
    const primarySourceId = primary.sourceId;

    const allStatuses = sorted.map((e) => deriveStatus(map, e.layerId, e.sourceId, currentZoom));

    const sublayers: SublayerInfo[] = sublayerEntries.map((e) => ({
      layerId: e.layerId,
      name: e.layerId,
      sourceId: e.sourceId,
      status: deriveStatus(map, e.layerId, e.sourceId, currentZoom),
      drawOrder: e.drawOrder,
    }));

    const layer = map.getLayer(primary.layerId);
    const minZoom = (layer as any)?.minzoom ?? null;
    const maxZoom = (layer as any)?.maxzoom ?? null;

    const renderer: RendererInfo = {
      name: primary.layerId,
      primaryLayerId: primary.layerId,
      sourceIds,
      status: worstStatus(allStatuses),
      featureCount: getFeatureCount(map, primarySourceId),
      approximate: isApproximate(map, primarySourceId),
      zoomRange: [minZoom, maxZoom],
      drawOrder: primary.drawOrder,
      sublayers,
    };

    if (!categoryRenderers.has(category)) categoryRenderers.set(category, []);
    categoryRenderers.get(category)!.push(renderer);
  }

  // Step 5: Build final groups
  const result: LayerInspectorGroup[] = [];
  for (const category of ['airport', 'nav', 'dynamic'] as const) {
    const renderers = categoryRenderers.get(category) ?? [];
    if (renderers.length === 0) continue;

    renderers.sort((a, b) => a.drawOrder - b.drawOrder);

    result.push({
      category,
      renderers,
      drawnCount: renderers.filter((r) => r.status === 'drawn').length,
      totalCount: renderers.length,
    });
  }

  return result;
}
