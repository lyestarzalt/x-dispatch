import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LinearFeatureLayer } from '@/components/Map/layers/airport/LinearFeatureLayer';
import { PavementLayer } from '@/components/Map/layers/airport/PavementLayer';
import { RunwayLayer } from '@/components/Map/layers/airport/RunwayLayer';
import {
  addTaxiMapLabelLayers,
  bringTaxiMapLabelsToFront,
  setTaxiMapAirportLabels,
  setTaxiMapRouteLabels,
} from '@/components/Map/layers/dynamic/TaxiMapLabelsLayer';
import {
  addTaxiRouteLayer,
  bringTaxiRouteToFront,
  setTaxiRouteLines,
} from '@/components/Map/layers/dynamic/TaxiRouteLayer';
import { bearingDeg } from '@/lib/flightplan/builder/geometry';
import '@/lib/map/maplibreWorker';
import { AirportParser } from '@/lib/parsers/apt';
import { type GuidanceRoute, createGuidanceTracker } from '@/lib/taxiGuidance';
import { signedAngleDelta } from '@/lib/utils/math';
import { usePlaneStore } from '@/stores/planeStore';
import { guidanceRoutes, useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';

// EXPERIMENT (exp/taxi-mini-map): a heading-up taxi map under the detached strip,
// Apple Maps navigation style. Throwaway until the look is settled.

const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FOLLOW_ZOOM = 16.6;
const FOLLOW_PITCH = 50;
/** Aircraft sits this far down the map, so more of the taxi ahead shows. */
const AIRCRAFT_FROM_TOP = 0.62;
/** Camera moves smaller than this (degrees, about 1 m / 0.5°) are skipped. */
const MIN_MOVE_DEG = 0.00001;
const MIN_TURN_DEG = 0.5;
/** X-Plane sends about ten samples a second; the camera glides from one to the next. */
const GLIDE_MIN_MS = 50;
const GLIDE_MAX_MS = 250;
/** Gliding redraws the map every frame; 60 a second is smooth enough for taxiing. */
const MIN_FRAME_MS = 1000 / 60 - 1;
/** Sharper than the screen costs fill rate for no visible gain. */
const MAX_PIXEL_RATIO = 2;

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {},
  layers: [{ id: 'mini-bg', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } }],
};

interface Pose {
  lon: number;
  lat: number;
  heading: number;
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const turn = signedAngleDelta(a.heading, b.heading);
  return {
    lon: a.lon + (b.lon - a.lon) * t,
    lat: a.lat + (b.lat - a.lat) * t,
    heading: a.heading + turn * t,
  };
}

function aircraftElement(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="white" stroke="rgba(0,0,0,0.45)" stroke-width="1.2" stroke-linejoin="round"/>' +
    '</svg>';
  el.style.filter = 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))';
  return el;
}

type Tracker = ReturnType<typeof createGuidanceTracker>;

/**
 * The route the strip follows, as the guidance row picks it: the one the aircraft
 * is on or nearest to, else the departure. Both planned routes stay drawn; this one
 * carries the labels and the destination marker.
 */
function activeRoute(tracker: Tracker, routes: GuidanceRoute[]): GuidanceRoute | null {
  const state = usePlaneStore.getState().state;
  const tracked = state
    ? tracker.update(routes, { lat: state.latitude, lon: state.longitude })
    : null;
  return tracked?.route ?? routes[0] ?? null;
}

const sameRoutes = (a: GuidanceRoute[], b: GuidanceRoute[]) =>
  a.length === b.length && a.every((route, i) => route === b[i]);

/** Live aircraft when X-Plane is running, else a ghost at the start of the route. */
function currentPose(route: GuidanceRoute | null): Pose | null {
  const state = usePlaneStore.getState().state;
  if (state) return { lon: state.longitude, lat: state.latitude, heading: state.heading };
  const [a, b] = route?.points ?? [];
  if (!a) return null;
  const heading = b
    ? bearingDeg({ latitude: a.lat, longitude: a.lon }, { latitude: b.lat, longitude: b.lon })
    : 0;
  return { lon: a.lon, lat: a.lat, heading };
}

interface TaxiMiniMapProps {
  /** CSS scale the strip window applies; the map renders sharper to match. */
  scale: number;
}

export default function TaxiMiniMap({ scale }: TaxiMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: EMPTY_STYLE,
      center: [0, 0],
      zoom: FOLLOW_ZOOM,
      pitch: FOLLOW_PITCH,
      minZoom: 13,
      maxZoom: 19,
      attributionControl: false,
      dragPan: false,
      dragRotate: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: false,
      scrollZoom: { around: 'center' },
      fadeDuration: 0,
    });
    mapRef.current = map;
    const marker = new maplibregl.Marker({
      element: aircraftElement(),
      rotationAlignment: 'viewport',
    })
      .setLngLat([0, 0])
      .addTo(map);

    let ready = false;
    const tracker = createGuidanceTracker();
    let drawnIcao: string | null = null;
    let loadingIcao: string | null = null;
    let drawnRoutes: GuidanceRoute[] = [];
    let drawnActive: GuidanceRoute | null = null;
    let target: Pose | null = null;
    let shown: Pose | null = null;
    let glideFrom: Pose | null = null;
    let glideStart = 0;
    let glideMs = GLIDE_MIN_MS;
    let lastSampleAt = 0;
    let lastDrawAt = 0;
    let frame = 0;

    const draw = (pose: Pose) => {
      shown = pose;
      marker.setLngLat([pose.lon, pose.lat]);
      map.jumpTo({
        center: [pose.lon, pose.lat],
        bearing: pose.heading,
        padding: {
          top: container.clientHeight * AIRCRAFT_FROM_TOP * 0.9,
          bottom: 0,
          left: 0,
          right: 0,
        },
      });
    };

    // Runs only while gliding toward the latest sample; idle once the camera is there.
    const glide = (now: number) => {
      frame = 0;
      if (!ready || !target) return;
      if (!glideFrom) {
        draw(target);
        return;
      }
      if (now - lastDrawAt < MIN_FRAME_MS) {
        frame = requestAnimationFrame(glide);
        return;
      }
      lastDrawAt = now;
      const t = Math.min(1, (now - glideStart) / glideMs);
      draw(lerpPose(glideFrom, target, t));
      if (t < 1) frame = requestAnimationFrame(glide);
    };

    const follow = (jump = false) => {
      if (!ready) return;
      const active = activeRoute(tracker, guidanceRoutes(useTaxiGuidanceStore.getState()));
      // Taxiing from one planned route onto the other moves the labels with it.
      if (active !== drawnActive) void syncRoute();
      const pose = currentPose(active);
      if (!pose) return;
      if (
        !jump &&
        target &&
        Math.abs(pose.lon - target.lon) < MIN_MOVE_DEG &&
        Math.abs(pose.lat - target.lat) < MIN_MOVE_DEG &&
        Math.abs(pose.heading - target.heading) < MIN_TURN_DEG
      ) {
        return;
      }
      const now = performance.now();
      glideMs = Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, now - lastSampleAt));
      lastSampleAt = now;
      glideFrom = jump ? null : shown;
      glideStart = now;
      target = pose;
      if (!frame) frame = requestAnimationFrame(glide);
    };

    // The followed route's airport once per airport: pavement, runways, hold lines.
    const loadAirport = async (route: GuidanceRoute) => {
      const result = await window.airportAPI.getAirportData(route.icao);
      if (!result) return;
      const { data: airport } = new AirportParser(result.data).parse();
      airport.longitude = route.points[0]?.lon ?? 0;
      airport.latitude = route.points[0]?.lat ?? 0;
      for (const layer of [new PavementLayer(), new RunwayLayer(), new LinearFeatureLayer()]) {
        if (layer.hasData(airport)) await layer.render(map, airport);
      }
      setTaxiMapAirportLabels(map, airport);
    };

    // Every planned route, with the followed one labelled; cleared when the plan goes.
    const syncRoute = async () => {
      if (!ready) return;
      const routes = guidanceRoutes(useTaxiGuidanceStore.getState());
      const active = activeRoute(tracker, routes);
      if (sameRoutes(routes, drawnRoutes) && active === drawnActive) return;
      if (active && active.icao !== drawnIcao) {
        // One load at a time; it draws whatever is planned once the airport is in.
        if (loadingIcao === active.icao) return;
        loadingIcao = active.icao;
        await loadAirport(active);
        loadingIcao = null;
        drawnIcao = active.icao;
        void syncRoute();
        return;
      }
      drawnRoutes = routes;
      drawnActive = active;
      setTaxiRouteLines(
        map,
        routes.map((route) => route.points.map((p) => ({ longitude: p.lon, latitude: p.lat })))
      );
      setTaxiMapRouteLabels(map, active);
      // The airport layers land above the route; keep the green path and the labels on top.
      bringTaxiRouteToFront(map);
      bringTaxiMapLabelsToFront(map);
      follow(true);
    };

    map.on('load', () => {
      // Only here is the style certain to be loaded: addTaxiRouteLayer quietly does
      // nothing while the airport layers are still loading.
      addTaxiRouteLayer(map);
      addTaxiMapLabelLayers(map);
      ready = true;
      void syncRoute();
      follow(true);
    });
    const unsubscribePlane = usePlaneStore.subscribe(() => follow());
    const unsubscribeRoute = useTaxiGuidanceStore.subscribe(() => void syncRoute());

    return () => {
      unsubscribePlane();
      unsubscribeRoute();
      if (frame) cancelAnimationFrame(frame);
      marker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setPixelRatio(
      Math.min(MAX_PIXEL_RATIO, (window.devicePixelRatio || 1) * Math.max(1, scale))
    );
  }, [scale]);

  return <div ref={containerRef} className="h-full w-full" />;
}
