import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MeasureSnap } from '@/lib/measure/measureLabel';
import { haversineDistance } from '@/lib/utils/geomath';

export interface MeasurePoint {
  latitude: number;
  longitude: number;
}

export interface MeasureLine {
  /** At least two vertices; the line runs through them in order. */
  points: MeasurePoint[];
  /** Anchor the first point attached to, if any. */
  snap: MeasureSnap | null;
}

/** Consecutive points closer than this collapse into one: a mis-click, not a leg. */
const MIN_LEG_M = 1;

interface MeasureState {
  /** The placed line, kept across restarts. */
  line: MeasureLine | null;
  /** The line being placed: its last point follows the mouse. Never persisted. */
  draft: MeasureLine | null;
  placing: boolean;
  start: (from: MeasurePoint, snap: MeasureSnap | null) => void;
  /** Move the following point. */
  moveEnd: (to: MeasurePoint) => void;
  /** Fix the following point as a vertex and start a new leg from it. */
  addPoint: () => void;
  /** Promote the draft without its following point; false when fewer than two distinct points remain. */
  finish: () => boolean;
  cancel: () => void;
  setPoint: (index: number, point: MeasurePoint) => void;
  setSnap: (snap: MeasureSnap | null) => void;
  removePoint: (index: number) => void;
  clear: () => void;
}

type PersistedMeasure = Pick<MeasureState, 'line'>;

function distinct(points: MeasurePoint[]): MeasurePoint[] {
  const out: MeasurePoint[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (
      prev &&
      haversineDistance(prev.latitude, prev.longitude, p.latitude, p.longitude) < MIN_LEG_M
    )
      continue;
    out.push(p);
  }
  return out;
}

/** Exported for tests. Cascades, no early returns. */
export function migrateMeasure(persisted: unknown, version: number): PersistedMeasure {
  const state = (persisted ?? {}) as Record<string, unknown>;
  if (version < 1) {
    if (state.line === undefined) state.line = null;
  }
  if (version < 2) {
    // v1 held a single start/end pair; v2 is a list of vertices.
    const old = state.line as {
      from?: MeasurePoint;
      to?: MeasurePoint;
      snap?: MeasureSnap | null;
    } | null;
    if (old && old.from && old.to) {
      state.line = { points: [old.from, old.to], snap: old.snap ?? null };
    }
  }
  return { line: (state.line as MeasureLine | null | undefined) ?? null };
}

export const useMeasureStore = create<MeasureState>()(
  persist(
    (set, get) => ({
      line: null,
      draft: null,
      placing: false,

      start: (from, snap) => set({ draft: { points: [from, from], snap }, placing: true }),

      moveEnd: (to) =>
        set((state) => {
          if (!state.draft) return {};
          const points = state.draft.points.slice(0, -1);
          points.push(to);
          return { draft: { ...state.draft, points } };
        }),

      addPoint: () =>
        set((state) => {
          if (!state.draft) return {};
          const last = state.draft.points[state.draft.points.length - 1];
          if (!last) return {};
          return { draft: { ...state.draft, points: [...state.draft.points, last] } };
        }),

      finish: () => {
        const { draft } = get();
        if (!draft) return false;
        const points = distinct(draft.points.slice(0, -1));
        if (points.length < 2) {
          set({ draft: null, placing: false });
          return false;
        }
        set({ line: { points, snap: draft.snap }, draft: null, placing: false });
        return true;
      },

      cancel: () => set({ draft: null, placing: false }),

      setPoint: (index, point) =>
        set((state) => {
          if (!state.line || index < 0 || index >= state.line.points.length) return {};
          const points = state.line.points.slice();
          points[index] = point;
          return { line: { ...state.line, points } };
        }),

      setSnap: (snap) => set((state) => (state.line ? { line: { ...state.line, snap } } : {})),

      removePoint: (index) =>
        set((state) => {
          if (!state.line || state.line.points.length <= 2) return {};
          const points = state.line.points.filter((_, i) => i !== index);
          return { line: { ...state.line, points, snap: index === 0 ? null : state.line.snap } };
        }),

      clear: () => set({ line: null, draft: null, placing: false }),
    }),
    {
      name: 'x-dispatch-measure',
      version: 2,
      partialize: (state) => ({ line: state.line }),
      migrate: (persisted, version) => migrateMeasure(persisted, version),
    }
  )
);
