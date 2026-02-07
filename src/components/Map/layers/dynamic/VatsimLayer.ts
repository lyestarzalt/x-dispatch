import maplibregl from 'maplibre-gl';
import type { VatsimPilot } from '@/types/vatsim';

const PILOT_LAYER_ID = 'vatsim-pilots';
const PILOT_SOURCE_ID = 'vatsim-pilots-source';
const TRAIL_LAYER_ID = 'vatsim-trails';
const TRAIL_SOURCE_ID = 'vatsim-trails-source';
const LABEL_LAYER_ID = 'vatsim-labels';

const COLOR = '#22c55e';
const COLOR_GLOW = '#16a34a';

const ICON_SVG = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L4 16h4v2h4v-2h4L10 2z" fill="${COLOR}" stroke="#000" stroke-width="0.5"/></svg>`;

function createIcon(): string {
  return `data:image/svg+xml;base64,${btoa(ICON_SVG)}`;
}

function calculateTrail(
  lat: number,
  lon: number,
  heading: number,
  speed: number
): [number, number][] {
  if (speed < 30) return [];
  const len = Math.min(0.12, Math.max(0.02, speed / 4000));
  const rad = ((heading + 180) % 360) * (Math.PI / 180);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const points: [number, number][] = [[lon, lat]];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    const segLen = len * t;
    const curve = Math.max(0, 1 - speed / 600) * 0.02 * Math.sin(t * Math.PI);
    points.push([lon + (segLen * Math.sin(rad) + curve) / cosLat, lat + segLen * Math.cos(rad)]);
  }
  return points;
}

function createPilotGeoJSON(pilots: VatsimPilot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pilots.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
      properties: {
        cid: p.cid,
        callsign: p.callsign,
        altitude: p.altitude,
        groundspeed: p.groundspeed,
        heading: p.heading,
        transponder: p.transponder,
        departure: p.flight_plan?.departure || '',
        arrival: p.flight_plan?.arrival || '',
        alternate: p.flight_plan?.alternate || '',
        aircraft: p.flight_plan?.aircraft_short || p.flight_plan?.aircraft_faa || '',
        flightRules: p.flight_plan?.flight_rules || '',
        filedAlt: p.flight_plan?.altitude || '',
        cruiseTas: p.flight_plan?.cruise_tas || '',
        route: p.flight_plan?.route || '',
        name: p.name,
        pilotRating: p.pilot_rating,
        flightLevel: Math.round(p.altitude / 100),
      },
    })),
  };
}

function createTrailGeoJSON(pilots: VatsimPilot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pilots
      .filter((p) => p.groundspeed > 30)
      .map((p) => {
        const trail = calculateTrail(p.latitude, p.longitude, p.heading, p.groundspeed);
        if (trail.length < 2) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: trail },
          properties: { callsign: p.callsign, groundspeed: p.groundspeed },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

const iconLoaded = new WeakSet<maplibregl.Map>();

export function addVatsimPilotLayer(map: maplibregl.Map, pilots: VatsimPilot[]): void {
  removeVatsimPilotLayer(map);
  if (pilots.length === 0) return;

  const pilotGeoJSON = createPilotGeoJSON(pilots);
  const trailGeoJSON = createTrailGeoJSON(pilots);

  if (!iconLoaded.has(map) && !map.hasImage('aircraft-icon')) {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage('aircraft-icon')) map.addImage('aircraft-icon', img, { sdf: false });
      iconLoaded.add(map);
      addVatsimPilotLayer(map, pilots);
    };
    img.onerror = () => {
      iconLoaded.add(map);
      addVatsimPilotLayer(map, pilots);
    };
    img.src = createIcon();
    return;
  }

  map.addSource(TRAIL_SOURCE_ID, { type: 'geojson', data: trailGeoJSON });
  map.addLayer({
    id: TRAIL_LAYER_ID,
    type: 'line',
    source: TRAIL_SOURCE_ID,
    paint: {
      'line-color': COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 2.5, 12, 3],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 8, 0.5, 12, 0.6],
      'line-blur': 1,
    },
  });

  map.addSource(PILOT_SOURCE_ID, { type: 'geojson', data: pilotGeoJSON });
  map.addLayer({
    id: `${PILOT_LAYER_ID}-glow`,
    type: 'circle',
    source: PILOT_SOURCE_ID,
    paint: {
      'circle-color': COLOR_GLOW,
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
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 6, 0.8, 10, 1, 14, 1.2],
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
        'circle-color': COLOR,
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
      'text-color': COLOR,
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

export function updateVatsimPilotLayer(map: maplibregl.Map, pilots: VatsimPilot[]): void {
  const pilotSource = map.getSource(PILOT_SOURCE_ID) as maplibregl.GeoJSONSource;
  const trailSource = map.getSource(TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource;
  if (pilotSource && trailSource) {
    pilotSource.setData(createPilotGeoJSON(pilots));
    trailSource.setData(createTrailGeoJSON(pilots));
  } else {
    addVatsimPilotLayer(map, pilots);
  }
}

export function setVatsimPilotLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const v = visible ? 'visible' : 'none';
  if (map.getLayer(PILOT_LAYER_ID)) map.setLayoutProperty(PILOT_LAYER_ID, 'visibility', v);
  if (map.getLayer(`${PILOT_LAYER_ID}-glow`))
    map.setLayoutProperty(`${PILOT_LAYER_ID}-glow`, 'visibility', v);
  if (map.getLayer(TRAIL_LAYER_ID)) map.setLayoutProperty(TRAIL_LAYER_ID, 'visibility', v);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', v);
}

export function bringVatsimLayersToTop(map: maplibregl.Map): void {
  if (map.getLayer(TRAIL_LAYER_ID)) map.moveLayer(TRAIL_LAYER_ID);
  if (map.getLayer(`${PILOT_LAYER_ID}-glow`)) map.moveLayer(`${PILOT_LAYER_ID}-glow`);
  if (map.getLayer(PILOT_LAYER_ID)) map.moveLayer(PILOT_LAYER_ID);
  if (map.getLayer(LABEL_LAYER_ID)) map.moveLayer(LABEL_LAYER_ID);
}

const clickHandlerSetup = new WeakSet<maplibregl.Map>();

export function setupVatsimClickHandler(map: maplibregl.Map, popup: maplibregl.Popup): void {
  if (clickHandlerSetup.has(map)) return;
  clickHandlerSetup.add(map);

  map.on('click', PILOT_LAYER_ID, (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

    const routeTruncated = props.route
      ? props.route.length > 40
        ? props.route.slice(0, 40) + '...'
        : props.route
      : '';
    const html = `
      <div class="bg-card text-foreground p-4 rounded-lg border border-success/30 min-w-[260px] shadow-xl">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-border">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span class="text-success font-bold font-mono text-sm">${props.callsign}</span>
          </div>
          <span class="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">${props.flightRules || 'N/A'}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div class="flex justify-between"><span class="text-muted-foreground">Aircraft</span><span class="font-mono">${props.aircraft || 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Squawk</span><span class="font-mono">${props.transponder || 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Altitude</span><span class="font-mono">${props.altitude?.toLocaleString() || 0} ft</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Filed</span><span class="font-mono">${props.filedAlt || 'N/A'}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">GS</span><span class="font-mono">${props.groundspeed || 0} kts</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">TAS</span><span class="font-mono">${props.cruiseTas || 'N/A'} kts</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Heading</span><span class="font-mono">${props.heading || 0}°</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">CID</span><span class="font-mono">${props.cid}</span></div>
        </div>
        ${
          props.departure || props.arrival
            ? `
        <div class="mt-3 pt-2 border-t border-border">
          <div class="flex items-center justify-center gap-2 text-sm">
            <span class="font-mono font-bold text-info">${props.departure || '????'}</span>
            <span class="text-muted-foreground">→</span>
            <span class="font-mono font-bold text-info">${props.arrival || '????'}</span>
            ${props.alternate ? `<span class="text-muted-foreground text-xs">(${props.alternate})</span>` : ''}
          </div>
          ${routeTruncated ? `<div class="mt-1.5 text-xs text-muted-foreground font-mono text-center">${routeTruncated}</div>` : ''}
        </div>`
            : ''
        }
        <div class="mt-3 pt-2 border-t border-border text-xs text-muted-foreground">${props.name}</div>
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
