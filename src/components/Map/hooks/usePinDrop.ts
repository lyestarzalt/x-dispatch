import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useAppStore } from '@/stores/appStore';
import type { MapRef } from './useMapSetup';

const SOURCE_ID = 'pindrop-source';
const LAYER_ID = 'pindrop-layer';
const IMAGE_ID = 'pindrop-airplane';

// Fixed pixel radius for the rotation handle — matches the constant icon-size
const HANDLE_RADIUS = 28;

// Design system success green
const PIN_COLOR = '#2eb86b';
const PIN_GLOW = 'rgba(46,184,107,0.35)';
const PIN_DIM = 'rgba(46,184,107,0.25)';
const PIN_LINE = 'rgba(46,184,107,0.4)';

// ──── 3D glossy arrow — same shape as PlaneLayer, cyan palette ────

const AIRPLANE_SVG = `<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pdL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5ee89a"/>
      <stop offset="100%" stop-color="#2eb86b"/>
    </linearGradient>
    <linearGradient id="pdR" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1d8a4e"/>
      <stop offset="100%" stop-color="#0d5a2f"/>
    </linearGradient>
    <linearGradient id="pdS" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.5)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <polygon points="17,5 29,28 17,22 5,28" fill="rgba(0,0,0,0.25)"/>
  <polygon points="16,3 16,20 6,26" fill="url(#pdL)"/>
  <polygon points="16,3 16,20 26,26" fill="url(#pdR)"/>
  <polygon points="6,26 16,20 12,20" fill="#1a7844"/>
  <polygon points="26,26 16,20 20,20" fill="#0d5a2f"/>
  <line x1="16" y1="3" x2="16" y2="20" stroke="rgba(255,255,255,0.25)" stroke-width="0.6"/>
  <polygon points="16,3 16,12 10,14" fill="url(#pdS)" opacity="0.4"/>
  <line x1="16" y1="3" x2="6" y2="26" stroke="rgba(255,255,255,0.15)" stroke-width="0.4"/>
</svg>`;

// ──── GeoJSON helpers ────

function makeGeoJSON(
  lng: number,
  lat: number,
  heading: number
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { heading },
      },
    ],
  };
}

function ensureImage(map: maplibregl.Map): Promise<void> {
  if (map.hasImage(IMAGE_ID)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(IMAGE_ID)) {
        map.addImage(IMAGE_ID, img, { sdf: false });
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:image/svg+xml;base64,${btoa(AIRPLANE_SVG)}`;
  });
}

function ensureSourceAndLayer(map: maplibregl.Map, lng: number, lat: number, heading: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: makeGeoJSON(lng, lat, heading),
    });
  }
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': IMAGE_ID,
        'icon-size': 0.9,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {},
    });
  }
}

function removeSourceAndLayer(map: maplibregl.Map) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function updateSource(map: maplibregl.Map, lng: number, lat: number, heading: number) {
  const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(makeGeoJSON(lng, lat, heading));
}

// ──── Rotation handle (DOM overlay marker) ────

function createRotationHandle(
  map: maplibregl.Map,
  heading: number,
  onRotate: (heading: number) => void,
  onRotateEnd: () => void
): maplibregl.Marker {
  const SIZE = HANDLE_RADIUS * 2 + 20;
  const CENTER = SIZE / 2;

  const el = document.createElement('div');
  el.style.cssText = `width: ${SIZE}px; height: ${SIZE}px; position: relative; pointer-events: none;`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(SIZE));
  svg.setAttribute('height', String(SIZE));
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.style.cssText = 'position: absolute; inset: 0;';

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', String(CENTER));
  ring.setAttribute('cy', String(CENTER));
  ring.setAttribute('r', String(HANDLE_RADIUS));
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', PIN_DIM);
  ring.setAttribute('stroke-width', '1');
  ring.setAttribute('stroke-dasharray', '4 6');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(CENTER));
  line.setAttribute('y1', String(CENTER));
  line.setAttribute('stroke', PIN_LINE);
  line.setAttribute('stroke-width', '1');
  line.setAttribute('stroke-dasharray', '3 3');

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', PIN_COLOR);
  dot.setAttribute('stroke', 'rgba(255,255,255,0.6)');
  dot.setAttribute('stroke-width', '1.5');
  dot.style.cssText = `pointer-events: all; cursor: grab; filter: drop-shadow(0 0 4px ${PIN_GLOW});`;

  svg.append(ring, line, dot);
  el.appendChild(svg);

  // Glass-style heading badge
  const badge = document.createElement('div');
  badge.style.cssText = `
    position: absolute;
    pointer-events: none;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(10, 15, 20, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid ${PIN_DIM};
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-weight: 600;
    letter-spacing: 0.05em;
    white-space: nowrap;
    color: ${PIN_COLOR};
    transform: translate(-50%, -50%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  `;
  badge.textContent = `HDG ${String(Math.round(heading)).padStart(3, '0')}`;
  el.appendChild(badge);

  function updateHandlePosition(hdg: number) {
    const rad = ((hdg - 90) * Math.PI) / 180;
    const hx = CENTER + HANDLE_RADIUS * Math.cos(rad);
    const hy = CENTER + HANDLE_RADIUS * Math.sin(rad);
    line.setAttribute('x2', String(hx));
    line.setAttribute('y2', String(hy));
    dot.setAttribute('cx', String(hx));
    dot.setAttribute('cy', String(hy));

    const badgeRad = ((hdg + 180 - 90) * Math.PI) / 180;
    const bx = CENTER + (HANDLE_RADIUS + 20) * Math.cos(badgeRad);
    const by = CENTER + (HANDLE_RADIUS + 20) * Math.sin(badgeRad);
    badge.style.left = `${bx}px`;
    badge.style.top = `${by}px`;
    badge.textContent = `HDG ${String(Math.round(hdg)).padStart(3, '0')}`;
  }

  updateHandlePosition(heading);

  let rotating = false;

  const onMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    rotating = true;
    dot.style.cursor = 'grabbing';
    dot.setAttribute('r', '7');
    dot.setAttribute('fill', '#5ee89a');
    map.getCanvas().style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!rotating) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let hdg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (hdg < 0) hdg += 360;
    hdg = Math.round(hdg);
    updateHandlePosition(hdg);
    onRotate(hdg);
  };

  const onMouseUp = () => {
    rotating = false;
    dot.style.cursor = 'grab';
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', PIN_COLOR);
    map.getCanvas().style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    onRotateEnd();
  };

  dot.addEventListener('mousedown', onMouseDown);

  const marker = new maplibregl.Marker({ element: el, anchor: 'center' });

  (el as HTMLDivElement & { _updateHeading: (h: number) => void })._updateHeading =
    updateHandlePosition;

  return marker;
}

// ──── Store helper ────

function setStartPositionFromPin(lng: number, lat: number, heading: number) {
  const icao = useAppStore.getState().selectedICAO ?? 'ZZZZ';
  useAppStore.getState().setStartPosition({
    type: 'custom',
    name: 'Custom',
    airport: icao,
    latitude: lat,
    longitude: lng,
    heading: Math.round(heading),
    index: -1,
  });
}

function clearPin(
  map: maplibregl.Map,
  pinRef: React.MutableRefObject<{ lng: number; lat: number; heading: number } | null>,
  handleMarkerRef: React.MutableRefObject<maplibregl.Marker | null>
) {
  pinRef.current = null;
  handleMarkerRef.current?.remove();
  handleMarkerRef.current = null;
  removeSourceAndLayer(map);
  useAppStore.getState().setStartPosition(null);
}

// ──── Hook ────

interface UsePinDropOptions {
  mapRef: MapRef;
  styleVersion: number;
}

export function usePinDrop({ mapRef, styleVersion }: UsePinDropOptions) {
  const pinRef = useRef<{ lng: number; lat: number; heading: number } | null>(null);
  const handleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isDraggingRef = useRef(false);

  // Helper to show/create handle at given position
  const showHandleAt = useCallback(
    (map: maplibregl.Map, lng: number, lat: number, heading: number) => {
      if (handleMarkerRef.current) {
        handleMarkerRef.current.setLngLat([lng, lat]);
        const el = handleMarkerRef.current.getElement() as HTMLDivElement & {
          _updateHeading?: (h: number) => void;
        };
        el._updateHeading?.(heading);
        return;
      }
      const marker = createRotationHandle(
        map,
        heading,
        (hdg) => {
          if (!pinRef.current) return;
          pinRef.current.heading = hdg;
          updateSource(map, pinRef.current.lng, pinRef.current.lat, hdg);
        },
        () => {
          if (pinRef.current) {
            setStartPositionFromPin(pinRef.current.lng, pinRef.current.lat, pinRef.current.heading);
          }
        }
      );
      marker.setLngLat([lng, lat]).addTo(map);
      handleMarkerRef.current = marker;
    },
    []
  );

  // Re-add source/layer after style change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pinRef.current) return;

    const reAdd = async () => {
      await ensureImage(map);
      const { lng, lat, heading } = pinRef.current!;
      ensureSourceAndLayer(map, lng, lat, heading);
      updateSource(map, lng, lat, heading);
    };

    if (map.isStyleLoaded()) {
      reAdd();
    } else {
      map.once('style.load', reAdd);
    }
  }, [mapRef, styleVersion]);

  // Main interactions (drag to reposition)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();

    const onPinMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      e.preventDefault();
      isDraggingRef.current = true;
      canvas.style.cursor = 'grabbing';
      handleMarkerRef.current?.remove();
      handleMarkerRef.current = null;
      map.on('mousemove', onDragMove);
      map.once('mouseup', onDragUp);
    };

    const onDragMove = (e: maplibregl.MapMouseEvent) => {
      if (!isDraggingRef.current || !pinRef.current) return;
      pinRef.current.lng = e.lngLat.lng;
      pinRef.current.lat = e.lngLat.lat;
      updateSource(map, e.lngLat.lng, e.lngLat.lat, pinRef.current.heading);
    };

    const onDragUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = '';
      map.off('mousemove', onDragMove);
      if (pinRef.current) {
        setStartPositionFromPin(pinRef.current.lng, pinRef.current.lat, pinRef.current.heading);
        showHandleAt(map, pinRef.current.lng, pinRef.current.lat, pinRef.current.heading);
      }
    };

    const onMouseEnter = () => {
      if (!isDraggingRef.current) canvas.style.cursor = 'move';
    };
    const onMouseLeave = () => {
      if (!isDraggingRef.current) canvas.style.cursor = '';
    };

    map.on('mousedown', LAYER_ID, onPinMouseDown);
    map.on('mouseenter', LAYER_ID, onMouseEnter);
    map.on('mouseleave', LAYER_ID, onMouseLeave);

    return () => {
      map.off('mousedown', LAYER_ID, onPinMouseDown);
      map.off('mouseenter', LAYER_ID, onMouseEnter);
      map.off('mouseleave', LAYER_ID, onMouseLeave);
      map.off('mousemove', onDragMove);
    };
  }, [mapRef, showHandleAt]);

  // Store sync: clear pin when startPosition changes externally
  useEffect(() => {
    const unsub = useAppStore.subscribe(
      (s) => s.startPosition,
      (pos) => {
        const map = mapRef.current;
        if (!map) return;

        if (!pos || pos.type !== 'custom') {
          pinRef.current = null;
          handleMarkerRef.current?.remove();
          handleMarkerRef.current = null;
          removeSourceAndLayer(map);
        }
      }
    );

    return unsub;
  }, [mapRef]);

  // Cleanup on unmount
  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map) removeSourceAndLayer(map);
      handleMarkerRef.current?.remove();
      handleMarkerRef.current = null;
      pinRef.current = null;
    };
  }, [mapRef]);

  // Toggle: place at center if no pin, remove if pin exists
  const placeAtCenter = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    // Toggle off — remove existing pin
    if (pinRef.current) {
      clearPin(map, pinRef, handleMarkerRef);
      return;
    }

    // Place new pin at map center
    const center = map.getCenter();
    const heading = 0;
    pinRef.current = { lng: center.lng, lat: center.lat, heading };

    await ensureImage(map);
    ensureSourceAndLayer(map, center.lng, center.lat, heading);
    updateSource(map, center.lng, center.lat, heading);
    setStartPositionFromPin(center.lng, center.lat, heading);
    showHandleAt(map, center.lng, center.lat, heading);
  }, [mapRef, showHandleAt]);

  return { placeAtCenter };
}

export const PINDROP_LAYER_ID = LAYER_ID;
