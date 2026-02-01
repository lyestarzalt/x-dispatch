import maplibregl from 'maplibre-gl';
import type { VatsimPilot } from '@/types/vatsim';

const PILOT_LAYER_ID = 'vatsim-pilots';
const PILOT_SOURCE_ID = 'vatsim-pilots-source';
const TRAIL_LAYER_ID = 'vatsim-trails';
const TRAIL_SOURCE_ID = 'vatsim-trails-source';
const LABEL_LAYER_ID = 'vatsim-labels';

const PILOT_COLOR = '#22c55e'; // Tailwind green-500
const PILOT_GLOW_COLOR = '#16a34a'; // Tailwind green-600

// SVG aircraft icon (pointing up/north) - will be rotated by heading
const AIRCRAFT_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2 L14 8 L20 10 L14 12 L14 18 L12 22 L10 18 L10 12 L4 10 L10 8 Z" fill="${PILOT_COLOR}" stroke="#0a0a0a" stroke-width="0.5"/>
</svg>
`;

function createAircraftIcon(): string {
  const encoded = btoa(AIRCRAFT_SVG.trim());
  return `data:image/svg+xml;base64,${encoded}`;
}

// Calculate trail points - creates a curved wake effect
function calculateTrailPoints(
  lat: number,
  lon: number,
  heading: number,
  groundspeed: number
): [number, number][] {
  if (groundspeed < 30) return []; // No trail for very slow/stationary

  // Trail length based on speed
  const baseLength = Math.min(0.12, Math.max(0.02, groundspeed / 4000));

  // Convert heading to radians (opposite direction for trail)
  const headingRad = ((heading + 180) % 360) * (Math.PI / 180);
  const cosLat = Math.cos((lat * Math.PI) / 180);

  const points: [number, number][] = [[lon, lat]];

  // Create multiple points for smoother trail
  const segments = 4;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const segmentLength = baseLength * t;

    const curveFactor = Math.max(0, 1 - groundspeed / 600) * 0.02 * Math.sin(t * Math.PI);

    const dLat = segmentLength * Math.cos(headingRad);
    const dLon = (segmentLength * Math.sin(headingRad) + curveFactor) / cosLat;

    points.push([lon + dLon, lat + dLat]);
  }

  return points;
}

function createPilotGeoJSON(pilots: VatsimPilot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pilots.map((pilot) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pilot.longitude, pilot.latitude],
      },
      properties: {
        cid: pilot.cid,
        callsign: pilot.callsign,
        altitude: pilot.altitude,
        groundspeed: pilot.groundspeed,
        heading: pilot.heading,
        transponder: pilot.transponder,
        departure: pilot.flight_plan?.departure || '',
        arrival: pilot.flight_plan?.arrival || '',
        aircraft: pilot.flight_plan?.aircraft_short || pilot.flight_plan?.aircraft_faa || '',
        route: pilot.flight_plan?.route || '',
        name: pilot.name,
        flightLevel: Math.round(pilot.altitude / 100),
        // Size based on aircraft type (larger = heavier)
        iconSize: pilot.flight_plan?.aircraft_short?.includes('H') ? 0.8 : 1.0,
      },
    })),
  };
}

function createTrailGeoJSON(pilots: VatsimPilot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pilots
      .filter((p) => p.groundspeed > 30)
      .map((pilot) => {
        const trailPoints = calculateTrailPoints(
          pilot.latitude,
          pilot.longitude,
          pilot.heading,
          pilot.groundspeed
        );

        if (trailPoints.length < 2) {
          return null;
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: trailPoints,
          },
          properties: {
            callsign: pilot.callsign,
            groundspeed: pilot.groundspeed,
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

const iconLoaded = new WeakSet<maplibregl.Map>();

export function addVatsimPilotLayer(
  map: maplibregl.Map,
  pilots: VatsimPilot[],
  highlightAirport?: string
): void {
  removeVatsimPilotLayer(map);

  if (pilots.length === 0) {
    return;
  }

  const pilotGeoJSON = createPilotGeoJSON(pilots);
  const trailGeoJSON = createTrailGeoJSON(pilots);

  if (!iconLoaded.has(map) && !map.hasImage('aircraft-icon')) {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage('aircraft-icon')) {
        map.addImage('aircraft-icon', img, { sdf: false });
      }
      iconLoaded.add(map);
      addVatsimPilotLayer(map, pilots, highlightAirport);
    };
    img.onerror = () => {
      iconLoaded.add(map);
      addVatsimPilotLayer(map, pilots, highlightAirport);
    };
    img.src = createAircraftIcon();
    return;
  }

  map.addSource(TRAIL_SOURCE_ID, {
    type: 'geojson',
    data: trailGeoJSON,
  });

  map.addLayer({
    id: TRAIL_LAYER_ID,
    type: 'line',
    source: TRAIL_SOURCE_ID,
    paint: {
      'line-color': PILOT_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 2.5, 12, 3],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 8, 0.5, 12, 0.6],
      'line-blur': 1,
    },
  });

  map.addSource(PILOT_SOURCE_ID, {
    type: 'geojson',
    data: pilotGeoJSON,
  });

  map.addLayer({
    id: `${PILOT_LAYER_ID}-glow`,
    type: 'circle',
    source: PILOT_SOURCE_ID,
    paint: {
      'circle-color': PILOT_GLOW_COLOR,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 6, 12, 8],
      'circle-blur': 0.8,
      'circle-opacity': 0.4,
    },
  });

  if (map.hasImage('aircraft-icon')) {
    map.addLayer({
      id: PILOT_LAYER_ID,
      type: 'symbol',
      source: PILOT_SOURCE_ID,
      layout: {
        'icon-image': 'aircraft-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 6, 0.5, 10, 0.7, 14, 0.9],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  } else {
    map.addLayer({
      id: PILOT_LAYER_ID,
      type: 'circle',
      source: PILOT_SOURCE_ID,
      paint: {
        'circle-color': PILOT_COLOR,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 6, 5, 10, 6, 14, 8],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000',
      },
    });
  }

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: PILOT_SOURCE_ID,
    minzoom: 5,
    layout: {
      'text-field': [
        'format',
        ['get', 'callsign'],
        { 'font-scale': 1 },
        '\n',
        {},
        ['concat', 'FL', ['to-string', ['get', 'flightLevel']]],
        { 'font-scale': 0.8 },
      ],
      'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 10, 12, 11],
      'text-offset': [1.5, 0],
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': PILOT_COLOR,
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 1.5,
    },
  });
}

export function removeVatsimPilotLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(PILOT_LAYER_ID)) map.removeLayer(PILOT_LAYER_ID);
  if (map.getLayer(`${PILOT_LAYER_ID}-glow`)) map.removeLayer(`${PILOT_LAYER_ID}-glow`);
  if (map.getLayer(TRAIL_LAYER_ID)) map.removeLayer(TRAIL_LAYER_ID);
  if (map.getSource(PILOT_SOURCE_ID)) map.removeSource(PILOT_SOURCE_ID);
  if (map.getSource(TRAIL_SOURCE_ID)) map.removeSource(TRAIL_SOURCE_ID);
}

export function updateVatsimPilotLayer(
  map: maplibregl.Map,
  pilots: VatsimPilot[],
  highlightAirport?: string
): void {
  const pilotSource = map.getSource(PILOT_SOURCE_ID) as maplibregl.GeoJSONSource;
  const trailSource = map.getSource(TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource;

  if (pilotSource && trailSource) {
    pilotSource.setData(createPilotGeoJSON(pilots));
    trailSource.setData(createTrailGeoJSON(pilots));
  } else {
    addVatsimPilotLayer(map, pilots, highlightAirport);
  }
}

export function setVatsimPilotLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(PILOT_LAYER_ID)) map.setLayoutProperty(PILOT_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(`${PILOT_LAYER_ID}-glow`))
    map.setLayoutProperty(`${PILOT_LAYER_ID}-glow`, 'visibility', visibility);
  if (map.getLayer(TRAIL_LAYER_ID)) map.setLayoutProperty(TRAIL_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

// Track if click handler is already set up (per map instance)
const clickHandlerSetup = new WeakSet<maplibregl.Map>();

// Setup click handler for pilot info popup
export function setupVatsimClickHandler(map: maplibregl.Map, popup: maplibregl.Popup): void {
  // Prevent duplicate handlers
  if (clickHandlerSetup.has(map)) {
    return;
  }
  clickHandlerSetup.add(map);

  map.on('click', PILOT_LAYER_ID, (e) => {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const props = feature.properties;
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

    const html = `
      <div class="bg-background/95 backdrop-blur-md text-foreground p-4 rounded-lg border border-green-500/30 min-w-[220px] shadow-xl">
        <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border">
          <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span class="text-green-400 font-bold font-mono">${props.callsign}</span>
        </div>

        <div class="space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Aircraft</span>
            <span class="font-mono">${props.aircraft || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Altitude</span>
            <span class="font-mono">${props.altitude?.toLocaleString() || 0} ft</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Speed</span>
            <span class="font-mono">${props.groundspeed || 0} kts</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Heading</span>
            <span class="font-mono">${props.heading || 0}°</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Squawk</span>
            <span class="font-mono">${props.transponder || 'N/A'}</span>
          </div>
        </div>

        ${
          props.departure || props.arrival
            ? `
          <div class="mt-3 pt-2 border-t border-border">
            <div class="flex items-center justify-center gap-2 text-sm">
              <span class="font-mono font-bold text-blue-400">${props.departure || '????'}</span>
              <span class="text-muted-foreground">→</span>
              <span class="font-mono font-bold text-blue-400">${props.arrival || '????'}</span>
            </div>
          </div>
        `
            : ''
        }

        <div class="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
          ${props.name}
        </div>
      </div>
    `;

    popup.setLngLat(coords).setHTML(html).addTo(map);
  });

  map.on('mouseenter', PILOT_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', PILOT_LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
  });
}

export const VATSIM_LAYER_IDS = [
  PILOT_LAYER_ID,
  `${PILOT_LAYER_ID}-glow`,
  TRAIL_LAYER_ID,
  LABEL_LAYER_ID,
];
