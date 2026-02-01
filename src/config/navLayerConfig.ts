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
};

export const NAV_COLORS = {
  airways: {
    line: '#4a4a4a',
    highLabelBg: '#333333',
    lowLabelBg: '#555555',
    labelText: '#ffffff',
  },
  vor: { standard: '#0066CC', dme: '#0088FF', tac: '#0044AA' },
  ndb: { standard: '#CC0099' },
  dme: { standard: '#0099CC' },
  ils: { localizer: '#CC6600', glideslope: '#FF9900' },
  waypoint: { standard: '#00CC66', compulsory: '#000000' },
  fir: '#FF69B4',
  airspace: {
    A: '#0066CC',
    B: '#0066CC',
    C: '#CC0099',
    D: '#0066CC',
    E: '#CC0099',
    F: '#CC6600',
    G: '#666666',
    CTR: '#0066CC',
    TMA: '#CC0099',
    R: '#CC0000',
    P: '#CC0000',
    Q: '#CC0000',
    W: '#CC6600',
    default: '#888888',
  },
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

export const GLOBAL_AIRSPACE_CLASSES = ['A', 'B', 'C', 'D', 'CTR', 'TMA', 'R', 'P'];

export function isGlobalAirspace(airspaceClass: string): boolean {
  if (!airspaceClass) return false;
  return GLOBAL_AIRSPACE_CLASSES.includes(airspaceClass.toUpperCase());
}

export function getAirspaceColor(airspaceClass: string): string {
  if (!airspaceClass) return NAV_COLORS.airspace.default;
  const upper = airspaceClass.toUpperCase();
  return (
    NAV_COLORS.airspace[upper as keyof typeof NAV_COLORS.airspace] || NAV_COLORS.airspace.default
  );
}
