import { create } from 'zustand';
import type {
  FlightDetail,
  FlightRecorderEvent,
  LandingReport,
  LiveRecorderState,
  TrackPointTuple,
} from '@/types/flightRecorder';

export interface ReplayState {
  flightId: string;
  track: TrackPointTuple[];
  landings: LandingReport[];
  /** Wall-clock position along the track, epoch ms. */
  cursorMs: number;
  playing: boolean;
  speed: number;
  follow: boolean;
}

export interface ShownLanding {
  flightId: string;
  report: LandingReport;
  shownAt: number;
}

interface FlightRecorderStoreState {
  live: LiveRecorderState;
  /** The landing currently on the card, cleared when dismissed. */
  landing: ShownLanding | null;
  replay: ReplayState | null;
  setLive: (live: LiveRecorderState) => void;
  applyEvent: (event: FlightRecorderEvent) => void;
  dismissLanding: () => void;
  startReplay: (flight: FlightDetail, opts?: { playing?: boolean }) => void;
  stopReplay: () => void;
  setReplayCursor: (cursorMs: number) => void;
  setReplayPlaying: (playing: boolean) => void;
  setReplaySpeed: (speed: number) => void;
  setReplayFollow: (follow: boolean) => void;
}

export const REPLAY_SPEEDS = [1, 4, 15, 60] as const;

const EMPTY_LIVE: LiveRecorderState = { flight: null, phase: 'preflight', track: [] };

/**
 * Mirror of the main-process recorder for the renderer. Track points arrive
 * about once a second, so map hooks subscribe here directly instead of going
 * through React state.
 */
export const useFlightRecorderStore = create<FlightRecorderStoreState>()((set) => ({
  live: EMPTY_LIVE,
  landing: null,
  replay: null,

  setLive: (live) => set({ live }),

  applyEvent: (event) =>
    set((state) => {
      switch (event.type) {
        case 'flightStarted':
          return { live: { flight: event.flight, phase: 'taxi-out', track: [] } };
        case 'phase':
          return { live: { ...state.live, phase: event.phase } };
        case 'track':
          if (state.live.flight?.id !== event.flightId) return {};
          return { live: { ...state.live, track: state.live.track.concat(event.points) } };
        case 'landing':
          return {
            landing: { flightId: event.flightId, report: event.report, shownAt: Date.now() },
          };
        case 'flightUpdated':
          if (state.live.flight?.id !== event.flight.id) return {};
          return { live: { ...state.live, flight: event.flight } };
        case 'flightEnded':
          if (state.live.flight?.id !== event.flight.id) return {};
          return { live: { ...state.live, flight: event.flight, phase: 'parked' } };
      }
    }),

  dismissLanding: () => set({ landing: null }),

  startReplay: (flight, opts) =>
    set({
      replay: {
        flightId: flight.id,
        track: flight.track,
        landings: flight.landings,
        cursorMs: flight.track[0]?.[0] ?? flight.startedAt,
        playing: opts?.playing ?? false,
        speed: REPLAY_SPEEDS[1],
        follow: true,
      },
    }),

  stopReplay: () => set({ replay: null }),

  setReplayCursor: (cursorMs) =>
    set((state) => (state.replay ? { replay: { ...state.replay, cursorMs } } : {})),

  setReplayPlaying: (playing) =>
    set((state) => (state.replay ? { replay: { ...state.replay, playing } } : {})),

  setReplaySpeed: (speed) =>
    set((state) => (state.replay ? { replay: { ...state.replay, speed } } : {})),

  setReplayFollow: (follow) =>
    set((state) => (state.replay ? { replay: { ...state.replay, follow } } : {})),
}));
