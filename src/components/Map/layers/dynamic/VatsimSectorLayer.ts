import maplibregl from 'maplibre-gl';
import { buildActiveFirMatches, buildActiveTraconMatches } from '@/lib/vatsimSectors/match';
import type { VatsimController } from '@/types/vatsim';
import type { VatsimSectorDataset } from '@/types/vatsimSectors';
import { ensurePillImage } from './badgeImages';

type SectorFeatureProperties = {
  id: string;
  name: string;
};

type SectorFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  SectorFeatureProperties
>;

type SectorLabelFeatureProperties = {
  id: string;
  label: string;
  imageId: string;
  kind: 'fir' | 'tracon';
};

type SectorLabelFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  SectorLabelFeatureProperties
>;

const INACTIVE_SOURCE_ID = 'vatsim-sectors-inactive-source';
const ACTIVE_SOURCE_ID = 'vatsim-sectors-active-source';
const TRACON_SOURCE_ID = 'vatsim-tracon-active-source';
const LABEL_SOURCE_ID = 'vatsim-sector-label-source';

const INACTIVE_LAYER_ID = 'vatsim-sectors-inactive';
const ACTIVE_LAYER_ID = 'vatsim-sectors-active';
const LABEL_LAYER_ID = 'vatsim-sectors-labels';
const TRACON_FILL_LAYER_ID = 'vatsim-tracon-active-fill';
const TRACON_OUTLINE_LAYER_ID = 'vatsim-tracon-active-outline';

const SECTOR_STYLE = {
  inactiveLine: '#717880',
  activeLine: '#34d399',
  labelBg: '#0d131a',
  traconFill: 'rgba(245, 158, 11, 0.10)',
  traconOutline: '#f59e0b',
} as const;

type Coordinate = [number, number];

function sanitizeImageFragment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function getSectorLabelImageId(kind: 'fir' | 'tracon', label: string): string {
  return `vatsim-sector-label-${kind}-${sanitizeImageFragment(label)}`;
}

function toFeature(item: {
  id: string;
  name: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, SectorFeatureProperties> {
  return {
    type: 'Feature',
    geometry: item.geometry,
    properties: {
      id: item.id,
      name: item.name,
    },
  };
}

function getOuterRings(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Coordinate[][] {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0] as Coordinate[]];
  }

  return geometry.coordinates.map((polygon) => polygon[0] as Coordinate[]);
}

function squaredDistance(a: Coordinate, b: Coordinate): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function closestPointOnSegment(point: Coordinate, start: Coordinate, end: Coordinate): Coordinate {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return start;
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared)
  );

  return [start[0] + t * dx, start[1] + t * dy];
}

function topLeftCoordinate(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Coordinate {
  const points = getOuterRings(geometry).flat();
  let minLng = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, maxLat];
}

function closestBoundaryCoordinate(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  reference?: Coordinate
): Coordinate {
  const target = reference ?? topLeftCoordinate(geometry);
  let bestPoint: Coordinate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const ring of getOuterRings(geometry)) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const point = closestPointOnSegment(target, ring[index]!, ring[index + 1]!);
      const distance = squaredDistance(target, point);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
    }
  }

  return bestPoint ?? target;
}

function toLabelFeature(args: {
  id: string;
  label: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  kind: 'fir' | 'tracon';
  anchor?: Coordinate;
}): GeoJSON.Feature<GeoJSON.Point, SectorLabelFeatureProperties> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: closestBoundaryCoordinate(args.geometry, args.anchor),
    },
    properties: {
      id: args.id,
      label: args.label,
      imageId: getSectorLabelImageId(args.kind, args.label),
      kind: args.kind,
    },
  };
}

export function buildSectorFeatureCollections(
  dataset: VatsimSectorDataset,
  controllers: VatsimController[]
): {
  inactive: SectorFeatureCollection;
  active: SectorFeatureCollection;
  tracon: SectorFeatureCollection;
  labels: SectorLabelFeatureCollection;
} {
  const activeSectorIds = new Set(
    buildActiveFirMatches(dataset, controllers).map((match) => match.sectorId)
  );
  const activeTraconIds = new Set(
    buildActiveTraconMatches(dataset, controllers).map((match) => match.traconId)
  );

  const activeFirs = dataset.firs.filter((fir) => activeSectorIds.has(fir.id));
  const inactiveFirs = dataset.firs.filter((fir) => !activeSectorIds.has(fir.id));
  const activeTracons = dataset.tracons.filter((tracon) => activeTraconIds.has(tracon.id));

  return {
    inactive: {
      type: 'FeatureCollection',
      features: inactiveFirs.map(toFeature),
    },
    active: {
      type: 'FeatureCollection',
      features: activeFirs.map(toFeature),
    },
    tracon: {
      type: 'FeatureCollection',
      features: activeTracons.map(toFeature),
    },
    labels: {
      type: 'FeatureCollection',
      features: [
        ...activeFirs.map((fir) =>
          toLabelFeature({
            id: fir.id,
            label: fir.icao,
            geometry: fir.geometry,
            kind: 'fir',
            anchor: fir.label,
          })
        ),
        ...activeTracons.map((tracon) =>
          toLabelFeature({
            id: tracon.id,
            label: tracon.id,
            geometry: tracon.geometry,
            kind: 'tracon',
            anchor: tracon.label,
          })
        ),
      ],
    },
  };
}

function upsertGeoJsonSource(map: maplibregl.Map, sourceId: string, data: GeoJSON.GeoJSON): void {
  const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, {
    type: 'geojson',
    data,
  });
}

function ensureSectorLabelImages(
  map: maplibregl.Map,
  labels: SectorLabelFeatureCollection['features']
): void {
  for (const feature of labels) {
    const properties = feature.properties;
    if (!properties) {
      continue;
    }

    ensurePillImage(map, properties.imageId, properties.label, {
      backgroundColor: SECTOR_STYLE.labelBg,
      borderColor:
        properties.kind === 'tracon' ? SECTOR_STYLE.traconOutline : SECTOR_STYLE.activeLine,
      textColor:
        properties.kind === 'tracon' ? SECTOR_STYLE.traconOutline : SECTOR_STYLE.activeLine,
      fontSize: 11,
      height: 20,
      minWidth: 34,
      paddingX: 8,
      radius: 6,
    });
  }
}

export function updateVatsimSectorLayer(
  map: maplibregl.Map,
  dataset: VatsimSectorDataset,
  controllers: VatsimController[]
): void {
  const collections = buildSectorFeatureCollections(dataset, controllers);

  upsertGeoJsonSource(map, INACTIVE_SOURCE_ID, collections.inactive);
  upsertGeoJsonSource(map, ACTIVE_SOURCE_ID, collections.active);
  upsertGeoJsonSource(map, TRACON_SOURCE_ID, collections.tracon);
  upsertGeoJsonSource(map, LABEL_SOURCE_ID, collections.labels);
  ensureSectorLabelImages(map, collections.labels.features);

  if (!map.getLayer(INACTIVE_LAYER_ID)) {
    map.addLayer({
      id: INACTIVE_LAYER_ID,
      type: 'line',
      source: INACTIVE_SOURCE_ID,
      paint: {
        'line-color': SECTOR_STYLE.inactiveLine,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.75, 6, 1.1, 10, 1.5],
        'line-opacity': 0.55,
      },
    });
  }

  if (!map.getLayer(ACTIVE_LAYER_ID)) {
    map.addLayer({
      id: ACTIVE_LAYER_ID,
      type: 'line',
      source: ACTIVE_SOURCE_ID,
      paint: {
        'line-color': SECTOR_STYLE.activeLine,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 6, 1.7, 10, 2.4],
        'line-opacity': 0.95,
      },
    });
  }

  if (!map.getLayer(TRACON_FILL_LAYER_ID)) {
    map.addLayer({
      id: TRACON_FILL_LAYER_ID,
      type: 'fill',
      source: TRACON_SOURCE_ID,
      paint: {
        'fill-color': SECTOR_STYLE.traconFill,
        'fill-opacity': 1,
      },
    });
  }

  if (!map.getLayer(TRACON_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: TRACON_OUTLINE_LAYER_ID,
      type: 'line',
      source: TRACON_SOURCE_ID,
      paint: {
        'line-color': SECTOR_STYLE.traconOutline,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 8, 1.5, 12, 2],
        'line-opacity': 0.9,
      },
    });
  }

  if (!map.getLayer(LABEL_LAYER_ID)) {
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: LABEL_SOURCE_ID,
      minzoom: 5,
      layout: {
        'icon-image': ['get', 'imageId'],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.95, 9, 1, 12, 1.05],
      },
    });
  }
}

export function removeVatsimSectorLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(TRACON_OUTLINE_LAYER_ID)) map.removeLayer(TRACON_OUTLINE_LAYER_ID);
  if (map.getLayer(TRACON_FILL_LAYER_ID)) map.removeLayer(TRACON_FILL_LAYER_ID);
  if (map.getLayer(ACTIVE_LAYER_ID)) map.removeLayer(ACTIVE_LAYER_ID);
  if (map.getLayer(INACTIVE_LAYER_ID)) map.removeLayer(INACTIVE_LAYER_ID);

  if (map.getSource(LABEL_SOURCE_ID)) map.removeSource(LABEL_SOURCE_ID);
  if (map.getSource(TRACON_SOURCE_ID)) map.removeSource(TRACON_SOURCE_ID);
  if (map.getSource(ACTIVE_SOURCE_ID)) map.removeSource(ACTIVE_SOURCE_ID);
  if (map.getSource(INACTIVE_SOURCE_ID)) map.removeSource(INACTIVE_SOURCE_ID);
}

export function bringVatsimSectorLayersToTop(map: maplibregl.Map): void {
  if (map.getLayer(INACTIVE_LAYER_ID)) map.moveLayer(INACTIVE_LAYER_ID);
  if (map.getLayer(ACTIVE_LAYER_ID)) map.moveLayer(ACTIVE_LAYER_ID);
  if (map.getLayer(TRACON_FILL_LAYER_ID)) map.moveLayer(TRACON_FILL_LAYER_ID);
  if (map.getLayer(TRACON_OUTLINE_LAYER_ID)) map.moveLayer(TRACON_OUTLINE_LAYER_ID);
  if (map.getLayer(LABEL_LAYER_ID)) map.moveLayer(LABEL_LAYER_ID);
}

export const VATSIM_SECTOR_LAYER_IDS = [
  INACTIVE_LAYER_ID,
  ACTIVE_LAYER_ID,
  LABEL_LAYER_ID,
  TRACON_FILL_LAYER_ID,
  TRACON_OUTLINE_LAYER_ID,
] as const;
