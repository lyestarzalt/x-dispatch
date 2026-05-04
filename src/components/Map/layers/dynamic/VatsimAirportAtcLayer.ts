import maplibregl from 'maplibre-gl';
import { buildAirportAtcSummaries } from '@/lib/vatsimSectors/match';
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { VatsimData } from '@/types/vatsim';
import { renderVatsimAirportAtcPopup } from './VatsimAirportAtcPopup';
import { type PillImageOptions, ensurePillImage } from './badgeImages';

type AirportBadgeLetter = 'A' | 'D' | 'G' | 'T';

type AirportAtcFeatureProperties = {
  id: string;
  icao: string;
  badgeLetter: AirportBadgeLetter;
  imageId: string;
  iconOffset: [number, number];
};

type AirportAtcFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  AirportAtcFeatureProperties
>;

const SOURCE_ID = 'vatsim-airport-atc-source';
const BADGE_LAYER_ID = 'vatsim-airport-atc-badges';

const BADGE_STYLES: Record<
  AirportBadgeLetter,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  D: { backgroundColor: '#13273d', borderColor: '#60a5fa', textColor: '#dbeafe' },
  G: { backgroundColor: '#0f2d22', borderColor: '#34d399', textColor: '#dcfce7' },
  T: { backgroundColor: '#34161b', borderColor: '#f87171', textColor: '#fee2e2' },
  A: { backgroundColor: '#39280f', borderColor: '#fbbf24', textColor: '#fef3c7' },
};

const popupSummaryCache = new WeakMap<maplibregl.Map, Map<string, string>>();
const clickHandlerSetup = new WeakSet<maplibregl.Map>();

export const AIRPORT_ATC_ICON_SIZE: maplibregl.DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  0.9,
  8,
  1.2,
  12,
  1.7,
  15,
  2.1,
] as const;

export function getAirportAtcBadgeImageId(letter: AirportBadgeLetter): string {
  return `vatsim-airport-atc-badge-${letter.toLowerCase()}`;
}

function badgeOffset(index: number, total: number): [number, number] {
  const width = 18;
  const horizontal = (index - (total - 1) / 2) * width;
  return [horizontal, -22];
}

export function getAirportAtcBadgeOptions(letter: AirportBadgeLetter): PillImageOptions {
  return {
    ...BADGE_STYLES[letter],
    fontSize: 11,
    height: 18,
    minWidth: 18,
    paddingX: 4,
    radius: 5,
    pixelRatio: 3,
  };
}

function ensureAirportBadgeImages(map: maplibregl.Map): void {
  (Object.keys(BADGE_STYLES) as AirportBadgeLetter[]).forEach((badgeLetter) => {
    ensurePillImage(
      map,
      getAirportAtcBadgeImageId(badgeLetter),
      badgeLetter,
      getAirportAtcBadgeOptions(badgeLetter)
    );
  });
}

export function buildAirportAtcFeatureCollection(
  airports: Airport[],
  vatsimData: VatsimData | undefined
): {
  collection: AirportAtcFeatureCollection;
  popupMap: Map<string, string>;
} {
  const airportByIcao = new Map(airports.map((airport) => [airport.icao.toUpperCase(), airport]));
  const summaries = buildAirportAtcSummaries(vatsimData, airports);
  const popupMap = new Map<string, string>();

  const features = summaries.flatMap((summary) => {
    const airport = airportByIcao.get(summary.icao);
    if (!airport || !summary.badges.length) {
      return [];
    }

    popupMap.set(summary.icao, renderVatsimAirportAtcPopup(airport, summary.controllers));

    return summary.badges.map((badge, index) => {
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
        properties: {
          id: `${summary.icao}-${badge.role}`,
          icao: summary.icao,
          badgeLetter: badge.letter,
          imageId: getAirportAtcBadgeImageId(badge.letter),
          iconOffset: badgeOffset(index, summary.badges.length),
        },
      };
    });
  });

  return {
    collection: {
      type: 'FeatureCollection',
      features,
    },
    popupMap,
  };
}

function upsertSource(map: maplibregl.Map, data: AirportAtcFeatureCollection): void {
  const existing = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data,
  });
}

export function updateVatsimAirportAtcLayer(
  map: maplibregl.Map,
  airports: Airport[],
  vatsimData: VatsimData | undefined
): void {
  const { collection, popupMap } = buildAirportAtcFeatureCollection(airports, vatsimData);
  popupSummaryCache.set(map, popupMap);
  upsertSource(map, collection);
  ensureAirportBadgeImages(map);

  if (!map.getLayer(BADGE_LAYER_ID)) {
    map.addLayer({
      id: BADGE_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': ['get', 'imageId'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-offset': ['get', 'iconOffset'],
        'icon-size': AIRPORT_ATC_ICON_SIZE,
      },
    });
  }
}

export function removeVatsimAirportAtcLayer(map: maplibregl.Map): void {
  if (map.getLayer(BADGE_LAYER_ID)) map.removeLayer(BADGE_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function bringVatsimAirportAtcLayersToTop(map: maplibregl.Map): void {
  if (map.getLayer(BADGE_LAYER_ID)) map.moveLayer(BADGE_LAYER_ID);
}

function handlePopupOpen(
  map: maplibregl.Map,
  feature: maplibregl.MapGeoJSONFeature,
  popup: maplibregl.Popup
): void {
  const icao = String(feature.properties?.icao ?? '');
  const html = popupSummaryCache.get(map)?.get(icao);
  if (!html || feature.geometry.type !== 'Point') {
    return;
  }

  popup
    .setLngLat(feature.geometry.coordinates as [number, number])
    .setHTML(html)
    .addTo(map);
}

export function setupVatsimAirportAtcClickHandler(
  map: maplibregl.Map,
  popup: maplibregl.Popup
): void {
  if (clickHandlerSetup.has(map)) {
    return;
  }

  clickHandlerSetup.add(map);

  map.on('click', BADGE_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }
    handlePopupOpen(map, feature, popup);
  });

  map.on('mouseenter', BADGE_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', BADGE_LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
  });
}
