export const NAV_ZOOM_LEVELS = {
  highAirways: { lines: 4, labels: 6 },
  lowAirways: { lines: 5, labels: 7 },
  vors: { symbols: 5, labels: 7 },
  ndbs: { symbols: 6, labels: 8 },
  dmes: { symbols: 8, labels: 10 },
  ils: { symbols: 9, labels: 10 },
  waypoints: { symbols: 8, labels: 11 },
  firBoundaries: { lines: 2, labels: 5 },
  airspaces: { fill: 6, labels: 9 },
  holdingPatterns: { track: 8, labels: 9 },
  mora: { fill: 5, labels: 5, maxZoom: 10 },
  msa: { sectors: 8, labels: 9 },
};

export const NAV_COLORS = {
  airways: {
    line: '#4a4a4a',
    highLabelBg: '#333333',
    lowLabelBg: '#555555',
    labelText: '#ffffff',
  },
  vor: '#0066CC',
  vorDme: '#0088FF',
  vortac: '#0044AA',
  ndb: '#9933CC',
  dme: '#0099CC',
  ils: '#FF8800',
  waypoint: { standard: '#00CC66', compulsory: '#000000' },
  fir: '#FF69B4',
  airspace: {
    A: '#3b82f6',
    B: '#3b82f6',
    C: '#d946ef',
    D: '#3b82f6',
    E: '#22c55e',
    F: '#f59e0b',
    G: '#6b7280',
    CTR: '#3b82f6',
    TMA: '#d946ef',
    R: '#ef4444',
    P: '#ef4444',
    Q: '#ef4444',
    W: '#f59e0b',
    GP: '#6b7280',
    default: '#6b7280',
  },
  holdingPattern: '#FF6B6B',
  mora: {
    low: '#3CB371',
    medium: '#FFD700',
    high: '#FF8C00',
    veryHigh: '#FF4500',
    grid: '#666666',
  },
  msa: '#9370DB',
};

const DEFAULT_AIRSPACE_STYLE = { fill: '#6b7280', border: '#4b5563', opacity: 0.1 };

export const AIRSPACE_STYLES: Record<string, { fill: string; border: string; opacity: number }> = {
  A: { fill: '#3b82f6', border: '#1d4ed8', opacity: 0.15 },
  B: { fill: '#3b82f6', border: '#1d4ed8', opacity: 0.15 },
  C: { fill: '#d946ef', border: '#a21caf', opacity: 0.15 },
  D: { fill: '#3b82f6', border: '#3b82f6', opacity: 0.1 },
  E: { fill: '#22c55e', border: '#16a34a', opacity: 0.08 },
  F: { fill: '#f59e0b', border: '#d97706', opacity: 0.1 },
  G: { fill: '#6b7280', border: '#4b5563', opacity: 0.05 },
  CTR: { fill: '#3b82f6', border: '#3b82f6', opacity: 0.2 },
  TMA: { fill: '#d946ef', border: '#a21caf', opacity: 0.15 },
  R: { fill: '#ef4444', border: '#dc2626', opacity: 0.2 },
  P: { fill: '#ef4444', border: '#dc2626', opacity: 0.2 },
  Q: { fill: '#ef4444', border: '#b91c1c', opacity: 0.15 },
  W: { fill: '#f59e0b', border: '#d97706', opacity: 0.15 },
  GP: { fill: '#6b7280', border: '#4b5563', opacity: 0.1 },
  OTHER: { fill: '#6b7280', border: '#4b5563', opacity: 0.1 },
};

export const NAV_LINE_STYLES = {
  airways: {
    high: {
      width: { base: 0.3, medium: 0.5, zoomed: 0.8, max: 1.2 },
      opacity: { base: 0.3, medium: 0.5, zoomed: 0.7 },
      dasharray: null as number[] | null,
    },
    low: {
      width: { base: 0.3, medium: 0.5, zoomed: 0.8, max: 1.0 },
      opacity: { base: 0.25, medium: 0.4, zoomed: 0.6 },
      dasharray: [4, 2] as number[],
    },
  },
  fir: { width: 1.5, opacity: 0.7 },
  airspace: { strokeWidth: 2, fillOpacity: 0.02, strokeOpacity: 0.6 },
};

export const NAV_SYMBOL_SIZES = {
  vor: { min: 0.4, medium: 0.6, large: 0.8, max: 1.0 },
  ndb: { min: 0.3, medium: 0.5, large: 0.7, max: 0.9 },
  waypoint: { min: 2, medium: 3, max: 4 },
  dme: { min: 4, medium: 6, max: 8 },
};

export const NAV_LABEL_STYLES = {
  fonts: {
    bold: ['Open Sans Bold'] as string[],
    semibold: ['Open Sans Semibold'] as string[],
    regular: ['Open Sans Regular'] as string[],
  },
  textSize: {
    airways: { min: 8, medium: 10, max: 11 },
    fir: 11,
    vor: 10,
    ndb: 9,
    dme: 8,
    waypoint: 8,
  },
  haloWidth: { small: 1, medium: 1.5, large: 2, airways: 3 },
  offset: {
    vor: [0, 2] as [number, number],
    ndb: [0, 1.8] as [number, number],
    dme: [0, 1.5] as [number, number],
    waypoint: [0, 0.6] as [number, number],
  },
};

export const NAV_LIMITS = {
  maxWaypoints: 2000,
  maxAirwaySegments: 50000,
  maxAirspaces: 5000,
  airwayLabelGridFactor: 2,
  autoLoadAirport: 10,
  autoLoadSearchRadius: 0.05,
  autoLoadDebounce: 500,
};

export const NAV_GLOBAL_LOADING = {
  firBoundaries: false, // X-Plane doesn't have FIR data, only individual airspaces
  airways: true,
  vors: false,
  ndbs: false,
  dmes: false,
  ils: false,
  waypoints: false,
  airspaces: false,
};

export function getAirspaceStyle(airspaceClass: string): {
  fill: string;
  border: string;
  opacity: number;
} {
  if (!airspaceClass) return DEFAULT_AIRSPACE_STYLE;
  const style = AIRSPACE_STYLES[airspaceClass.toUpperCase()];
  return style ?? DEFAULT_AIRSPACE_STYLE;
}

export function getAirspaceColor(airspaceClass: string): string {
  return getAirspaceStyle(airspaceClass).border;
}
