import { useEffect } from 'react';
import { EMPTY_TRAIL, trailSegments, trailStep } from '@/lib/flightRecorder/trailGeometry';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import type { TrackPointTuple } from '@/types/flightRecorder';
import {
  type TouchdownMarker,
  clearFlightTrail,
  ensureFlightTrailLayers,
  removeFlightTrailLayers,
  setFlightTrailHistory,
  setFlightTrailLive,
  setTouchdownMarkers,
} from '../layers/dynamic/FlightTrailLayer';
import type { MapRef } from './useMapSetup';

/** Points kept in the live source, which is rewritten on every new point. */
const LIVE_TAIL = 90;
/** The history source is rebuilt once this many points have piled up beyond the tail. */
const HISTORY_BATCH = 60;

interface UseFlightTrailOptions {
  mapRef: MapRef;
  enabled: boolean;
  flyToLanding: boolean;
}

/**
 * Draws the recorded track behind the aircraft. The long tail lives in a
 * source rebuilt about once a minute, the last minute and a half in a small
 * source rewritten per point, so a ten-hour flight never re-tiles tens of
 * thousands of segments every second.
 */
export function useFlightTrail({ mapRef, enabled, flyToLanding }: UseFlightTrailOptions): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!enabled) {
      removeFlightTrailLayers(map);
      return;
    }

    /** Index of the last point already covered by the history source. */
    let historyCut = 0;
    let historyFlightId: string | null = null;

    const resetHistory = () => {
      historyCut = 0;
      historyFlightId = null;
    };

    const drawLive = (track: TrackPointTuple[], flightId: string | null) => {
      if (flightId !== historyFlightId || track.length <= historyCut) {
        resetHistory();
        historyFlightId = flightId;
        setFlightTrailHistory(map, EMPTY_TRAIL);
      }
      if (track.length - historyCut > LIVE_TAIL + HISTORY_BATCH) {
        historyCut = track.length - LIVE_TAIL;
        const history = track.slice(0, historyCut + 1);
        setFlightTrailHistory(map, trailSegments(history, { step: trailStep(history.length) }));
      }
      setFlightTrailLive(map, trailSegments(track.slice(historyCut)));
    };

    const render = () => {
      if (!map.getStyle()) return;
      ensureFlightTrailLayers(map);
      const { live, replay, landing } = useFlightRecorderStore.getState();
      let markers: TouchdownMarker[];
      if (replay) {
        resetHistory();
        setFlightTrailLive(map, EMPTY_TRAIL);
        setFlightTrailHistory(
          map,
          trailSegments(replay.track, { step: trailStep(replay.track.length) })
        );
        markers = replay.landings.map((l) => ({ lat: l.lat, lon: l.lon, rating: l.rating }));
      } else if (live.track.length === 0) {
        clearFlightTrail(map);
        resetHistory();
        markers = [];
      } else {
        drawLive(live.track, live.flight?.id ?? null);
        markers = landing
          ? [{ lat: landing.report.lat, lon: landing.report.lon, rating: landing.report.rating }]
          : [];
      }
      setTouchdownMarkers(map, markers);
    };

    const onStyleLoad = () => {
      resetHistory();
      render();
    };

    const init = () => {
      render();
      map.on('style.load', onStyleLoad);
    };
    if (map.isStyleLoaded()) init();
    else map.once('load', init);

    const unsubscribe = useFlightRecorderStore.subscribe((state, prev) => {
      if (state.replay !== prev.replay) {
        resetHistory();
        render();
        return;
      }
      if (state.replay) return;
      if (state.live.track !== prev.live.track || state.landing !== prev.landing) render();
      if (flyToLanding && state.landing && state.landing !== prev.landing) {
        map.flyTo({
          center: [state.landing.report.lon, state.landing.report.lat],
          zoom: 15,
          pitch: 0,
          duration: 2500,
        });
      }
    });

    return () => {
      unsubscribe();
      map.off('style.load', onStyleLoad);
      map.off('load', init);
      removeFlightTrailLayers(map);
    };
  }, [mapRef, enabled, flyToLanding]);
}
