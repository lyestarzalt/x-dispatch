import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Coordinates } from '@/types/geo';
import type { MapRef } from './useMapSetup';

const IDLE_TIMEOUT_MS = 20_000;
const DEGREES_PER_SECOND = 6; // 360° in 60s
const FRAME_INTERVAL_MS = 50; // ~20fps
const MIN_ZOOM = 10;
const ORBIT_PITCH = 50;

interface UseIdleOrbitOptions {
  mapRef: MapRef;
  airportCenter: Coordinates | null;
}

const USER_EVENTS = [
  'dragstart',
  'wheel',
  'click',
  'touchstart',
  'zoomstart',
  'pitchstart',
  'rotatestart',
] as const;

export function useIdleOrbit({ mapRef, airportCenter }: UseIdleOrbitOptions) {
  const enabled = useSettingsStore((s) => s.map.idleOrbitEnabled);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const isProgrammaticRef = useRef(false);
  const orbitingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const bearingRef = useRef(0);

  const stopOrbit = useCallback(() => {
    orbitingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startOrbit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !airportCenter) return;
    if (map.getZoom() < MIN_ZOOM) return;

    orbitingRef.current = true;
    bearingRef.current = map.getBearing();
    lastFrameTimeRef.current = performance.now();

    const animate = () => {
      const m = mapRef.current;
      if (!m || !orbitingRef.current || !airportCenter) {
        rafRef.current = null;
        return;
      }

      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      if (delta < FRAME_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = now;

      const increment = DEGREES_PER_SECOND * (delta / 1000);
      bearingRef.current = (bearingRef.current + increment) % 360;

      isProgrammaticRef.current = true;
      m.easeTo({
        center: [airportCenter.longitude, airportCenter.latitude],
        bearing: bearingRef.current,
        pitch: ORBIT_PITCH,
        duration: FRAME_INTERVAL_MS,
        easing: (t) => t, // linear
      });
      isProgrammaticRef.current = false;

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [mapRef, airportCenter]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (!airportCenter || !enabled) return;

    idleTimerRef.current = setTimeout(() => {
      const map = mapRef.current;
      if (map && airportCenter && map.getZoom() >= MIN_ZOOM) {
        startOrbit();
      }
    }, IDLE_TIMEOUT_MS);
  }, [mapRef, airportCenter, startOrbit, enabled]);

  // Handle user interactions — stop orbit and restart idle timer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onUserInteraction = () => {
      if (isProgrammaticRef.current) return;
      stopOrbit();
      resetIdleTimer();
    };

    for (const event of USER_EVENTS) {
      map.on(event, onUserInteraction);
    }

    // Start the idle timer when an airport is selected
    resetIdleTimer();

    return () => {
      for (const event of USER_EVENTS) {
        map.off(event, onUserInteraction);
      }
      stopOrbit();
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [mapRef, airportCenter, stopOrbit, resetIdleTimer]);

  // Stop orbit when airport is cleared, zoom drops below threshold, or setting disabled
  useEffect(() => {
    if (!airportCenter || !enabled) {
      stopOrbit();
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }
  }, [airportCenter, enabled, stopOrbit]);
}
