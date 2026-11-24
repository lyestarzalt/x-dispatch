import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clamp } from '@/lib/utils/math';

/** The approach chart laid over the map. */
export interface OverlayChart {
  /** The chart's PDF on the FAA's server; it also identifies the chart. */
  url: string;
  /** The chart title, as the FAA prints it. */
  name: string;
  icao: string;
}

/**
 * Why a chart could not be shown: no answer from the FAA, a chart the FAA does not have for
 * the cycle, or a PDF that cannot be placed on the map.
 */
export type ChartOverlayError = 'network' | 'unavailable' | 'unplaceable';

export const CHART_OVERLAY_MIN_OPACITY = 0.1;
/** Solid enough to read the chart, with the map still showing through it. */
const DEFAULT_OPACITY = 0.7;

interface ChartOverlayState {
  /** The chart shown or being fetched; null with no overlay. */
  chart: OverlayChart | null;
  status: 'idle' | 'loading' | 'shown' | 'error';
  error: ChartOverlayError | null;
  /** From `CHART_OVERLAY_MIN_OPACITY` to 1; kept between sessions. */
  opacity: number;
  /** Shows a chart, or hides it when it is the one already shown. */
  toggle: (chart: OverlayChart) => void;
  hide: () => void;
  setShown: (url: string) => void;
  setError: (url: string, error: ChartOverlayError) => void;
  /** Back to loading, for another try at the chart that failed. */
  retry: () => void;
  setOpacity: (opacity: number) => void;
  /** Where the pilot dragged the chart's card; null at its default place. Kept between sessions. */
  cardPosition: { x: number; y: number } | null;
  setCardPosition: (position: { x: number; y: number } | null) => void;
}

export const useChartOverlayStore = create<ChartOverlayState>()(
  persist(
    (set, get) => ({
      chart: null,
      status: 'idle',
      error: null,
      opacity: DEFAULT_OPACITY,
      toggle: (chart) =>
        set(
          get().chart?.url === chart.url
            ? { chart: null, status: 'idle', error: null }
            : { chart, status: 'loading', error: null }
        ),
      hide: () => set({ chart: null, status: 'idle', error: null }),
      // A result for a chart the user has already left is dropped.
      setShown: (url) => {
        if (get().chart?.url === url) set({ status: 'shown', error: null });
      },
      setError: (url, error) => {
        if (get().chart?.url === url) set({ status: 'error', error });
      },
      retry: () => {
        if (get().chart) set({ status: 'loading', error: null });
      },
      setOpacity: (opacity) => set({ opacity: clamp(opacity, CHART_OVERLAY_MIN_OPACITY, 1) }),
      cardPosition: null,
      setCardPosition: (cardPosition) => set({ cardPosition }),
    }),
    {
      name: 'chart-overlay-store',
      version: 1,
      // The chart itself lasts for the session; the pilot's opacity and card place are kept.
      partialize: (state) => ({ opacity: state.opacity, cardPosition: state.cardPosition }),
    }
  )
);
