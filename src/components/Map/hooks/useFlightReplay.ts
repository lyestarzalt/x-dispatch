import { useEffect } from 'react';
import { sampleTrack, trackBounds } from '@/lib/flightRecorder/trailGeometry';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import { ensureFlightTrailLayers, setReplayPlane } from '../layers/dynamic/FlightTrailLayer';
import type { MapRef } from './useMapSetup';

const TICK_MS = 100;

/**
 * Moves the replay aircraft along the selected flight and, while following,
 * eases the camera with it. The trail itself is drawn by useFlightTrail.
 */
export function useFlightReplay(mapRef: MapRef): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let activeFlightId: string | null = null;
    let programmaticMove = false;

    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const draw = () => {
      const { replay } = useFlightRecorderStore.getState();
      if (!replay || !map.getStyle()) return;
      ensureFlightTrailLayers(map);
      const sample = sampleTrack(replay.track, replay.cursorMs);
      if (!sample) return;
      setReplayPlane(map, { lat: sample.lat, lon: sample.lon, heading: sample.hdg });
      if (replay.follow) {
        programmaticMove = true;
        map.easeTo({
          center: [sample.lon, sample.lat],
          bearing: sample.hdg,
          duration: replay.playing ? TICK_MS : 300,
          easing: (t) => t,
        });
        programmaticMove = false;
      }
    };

    const tick = () => {
      const state = useFlightRecorderStore.getState();
      const replay = state.replay;
      if (!replay || !replay.playing) return;
      const end = replay.track[replay.track.length - 1]?.[0] ?? replay.cursorMs;
      const next = replay.cursorMs + TICK_MS * replay.speed;
      if (next >= end) {
        state.setReplayCursor(end);
        state.setReplayPlaying(false);
      } else {
        state.setReplayCursor(next);
      }
    };

    const onReplayChange = () => {
      const { replay } = useFlightRecorderStore.getState();
      if (!replay) {
        stopTimer();
        activeFlightId = null;
        if (map.getStyle()) setReplayPlane(map, null);
        return;
      }
      if (replay.flightId !== activeFlightId) {
        activeFlightId = replay.flightId;
        const bounds = trackBounds(replay.track);
        if (bounds && bounds[0] !== bounds[2] && bounds[1] !== bounds[3]) {
          programmaticMove = true;
          map.fitBounds(
            [
              [bounds[0], bounds[1]],
              [bounds[2], bounds[3]],
            ],
            { padding: 120, duration: 1200, maxZoom: 12 }
          );
          setTimeout(() => {
            programmaticMove = false;
          }, 1300);
        }
      }
      if (replay.playing && !timer) timer = setInterval(tick, TICK_MS);
      if (!replay.playing) stopTimer();
      draw();
    };

    const onDragStart = () => {
      const state = useFlightRecorderStore.getState();
      if (state.replay?.follow && !programmaticMove) state.setReplayFollow(false);
    };
    map.on('dragstart', onDragStart);

    const unsubscribe = useFlightRecorderStore.subscribe((state, prev) => {
      if (state.replay !== prev.replay) onReplayChange();
    });
    onReplayChange();

    return () => {
      unsubscribe();
      stopTimer();
      map.off('dragstart', onDragStart);
      if (map.getStyle()) setReplayPlane(map, null);
    };
  }, [mapRef]);
}
