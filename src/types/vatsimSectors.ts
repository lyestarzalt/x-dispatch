import type { MultiPolygon, Polygon } from 'geojson';
import type { VatsimATIS, VatsimController } from './vatsim';

export type VatsimFacilityRole = 'ATIS' | 'DEL' | 'GND' | 'TWR' | 'APP' | 'CTR' | 'FSS' | 'OTHER';

export type VatsimSectorCacheState = 'empty' | 'loading' | 'ready' | 'stale' | 'error';

export interface VatsimFirFeature {
  id: string;
  icao: string;
  name: string;
  callsign?: string;
  boundaryId: string;
  geometry: Polygon | MultiPolygon;
  label?: [number, number];
  oceanic: boolean;
}

export interface VatsimTraconFeature {
  id: string;
  name: string;
  prefixes: string[];
  suffix?: string;
  geometry: Polygon | MultiPolygon;
  label?: [number, number];
}

export interface VatsimSectorDataset {
  version: {
    vatspy: string;
    simaware: string;
    builtAt: string;
  };
  firs: VatsimFirFeature[];
  tracons: VatsimTraconFeature[];
}

export interface VatsimSectorManifest {
  vatspyVersion: string;
  simawareVersion: string;
  builtAt: string;
  checkedAt: string;
  lastError: string | null;
}

export interface VatsimSectorQueryResult {
  state: VatsimSectorCacheState;
  dataset: VatsimSectorDataset | null;
  lastError: string | null;
}

export interface VatsimActiveFirMatch {
  sectorId: string;
  controllers: VatsimController[];
}

export interface VatsimActiveTraconMatch {
  traconId: string;
  controllers: VatsimController[];
  isTwrOnly: boolean;
}

export interface VatsimAirportAtcBadge {
  role: 'ATIS' | 'DEL' | 'GND' | 'TWR';
  letter: 'A' | 'D' | 'G' | 'T';
  controllers: Array<VatsimController | VatsimATIS>;
}

export interface VatsimAirportAtcSummary {
  icao: string;
  controllers: Array<VatsimController | VatsimATIS>;
  badges: VatsimAirportAtcBadge[];
}

export interface VatsimAirportAtcRow {
  id: string;
  role: VatsimFacilityRole;
  badgeLabel: string;
  badgeVariant: 'secondary' | 'warning' | 'info' | 'success' | 'danger';
  callsign: string;
  frequency: string;
  summary: string;
  detail?: string;
}
