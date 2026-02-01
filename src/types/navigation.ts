export {
  type NavaidType,
  type Navaid,
  type Waypoint,
  type AirwaySegment,
  type AirspaceClass,
  type Airspace,
  NAV_COLORS,
  AIRSPACE_STYLES,
} from '@/lib/navParser/types';

export interface AirwaySegmentWithCoords {
  name: string;
  fromFix: string;
  toFix: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  isHigh: boolean;
  baseFl: number;
  topFl: number;
}

export function formatNavaidFrequency(navaid: { type: string; frequency: number }): string {
  if (navaid.type === 'NDB') {
    return `${navaid.frequency} kHz`;
  }
  const mhz = navaid.frequency / 100;
  return `${mhz.toFixed(2)} MHz`;
}

export function getNavaidColor(type: string): string {
  switch (type) {
    case 'VOR':
    case 'VORTAC':
    case 'VOR-DME':
      return '#2563eb';
    case 'NDB':
      return '#7c3aed';
    case 'DME':
    case 'TACAN':
      return '#06b6d4';
    default:
      return '#6b7280';
  }
}

export function getAirspaceColor(airspaceClass: string): {
  fill: string;
  border: string;
  opacity: number;
} {
  const styles: Record<string, { fill: string; border: string; opacity: number }> = {
    A: { fill: '#3b82f6', border: '#1d4ed8', opacity: 0.15 },
    B: { fill: '#3b82f6', border: '#1d4ed8', opacity: 0.15 },
    C: { fill: '#d946ef', border: '#a21caf', opacity: 0.15 },
    D: { fill: '#3b82f6', border: '#3b82f6', opacity: 0.1 },
    E: { fill: '#22c55e', border: '#16a34a', opacity: 0.08 },
    CTR: { fill: '#3b82f6', border: '#3b82f6', opacity: 0.2 },
    TMA: { fill: '#d946ef', border: '#a21caf', opacity: 0.15 },
    R: { fill: '#ef4444', border: '#dc2626', opacity: 0.2 },
    P: { fill: '#ef4444', border: '#dc2626', opacity: 0.2 },
  };
  return styles[airspaceClass] || { fill: '#6b7280', border: '#4b5563', opacity: 0.1 };
}
