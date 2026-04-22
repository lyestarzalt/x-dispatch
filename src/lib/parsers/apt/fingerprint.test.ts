import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParsedAirport } from '@/types/apt';
import { AirportParser } from './index';

// ---------------------------------------------------------------------------
// Helpers (mirrors splitAptDat from index.test.ts)
// ---------------------------------------------------------------------------

function splitAptDat(content: string): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '99') {
      if (current.length > 0) {
        chunks.push(current.join('\n'));
        current = [];
      }
      break;
    }

    if (/^(1|16|17)\s/.test(trimmed)) {
      if (current.length > 0) {
        chunks.push(current.join('\n'));
      }
      current = [line];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

function parseAirport(chunk: string): ParsedAirport {
  return new AirportParser(chunk).parse().data;
}

// ---------------------------------------------------------------------------
// Fingerprint computation
// ---------------------------------------------------------------------------

type AirportType = 'land' | 'seaplane' | 'heliport';

interface Fingerprint {
  id: string;
  name: string;
  type: AirportType;
  runwayCount: number;
  taxiwayCount: number;
  pavementCount: number;
  boundaryCount: number;
  startupLocationCount: number;
  frequencyCount: number;
  helipadCount: number;
  signCount: number;
  windsockCount: number;
  linearFeatureCount: number;
  taxiNetworkNodeCount: number;
  taxiNetworkEdgeCount: number;
  totalPavementPoints: number;
  totalTaxiwayPoints: number;
  totalBoundaryPoints: number;
}

function getAirportType(chunk: string): AirportType {
  const match = chunk.match(/^(1|16|17)\s/m);
  if (!match) return 'land';
  if (match[1] === '16') return 'seaplane';
  if (match[1] === '17') return 'heliport';
  return 'land';
}

function computeFingerprint(airport: ParsedAirport, chunk: string): Fingerprint {
  const totalPavementPoints = airport.pavements.reduce((sum, p) => sum + p.coordinates.length, 0);

  const totalTaxiwayPoints = airport.taxiways.reduce(
    (sum, tw) => sum + tw.paths.reduce((s, path) => s + path.coordinates.length, 0),
    0
  );

  const totalBoundaryPoints = airport.boundaries.reduce(
    (sum, b) => sum + b.paths.reduce((s, path) => s + path.coordinates.length, 0),
    0
  );

  return {
    id: airport.id,
    name: airport.name,
    type: getAirportType(chunk),
    runwayCount: airport.runways.length,
    taxiwayCount: airport.taxiways.length,
    pavementCount: airport.pavements.length,
    boundaryCount: airport.boundaries.length,
    startupLocationCount: airport.startupLocations.length,
    frequencyCount: airport.frequencies.length,
    helipadCount: airport.helipads.length,
    signCount: airport.signs.length,
    windsockCount: airport.windsocks.length,
    linearFeatureCount: airport.linearFeatures.length,
    taxiNetworkNodeCount: airport.taxiNetwork?.nodes.length ?? 0,
    taxiNetworkEdgeCount: airport.taxiNetwork?.edges.length ?? 0,
    totalPavementPoints,
    totalTaxiwayPoints,
    totalBoundaryPoints,
  };
}

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/apt-sample.dat');

let chunks: string[];
let fingerprints: Map<string, Fingerprint>;

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  chunks = splitAptDat(raw);

  fingerprints = new Map();
  for (const chunk of chunks) {
    const airport = parseAirport(chunk);
    fingerprints.set(airport.id, computeFingerprint(airport, chunk));
  }

  // Uncomment to capture actual values during development:
  // console.log(JSON.stringify(Object.fromEntries(fingerprints), null, 2));
});

// ---------------------------------------------------------------------------
// Expected fingerprints — generated from a known-good parser run
// ---------------------------------------------------------------------------

const EXPECTED: Record<string, Fingerprint> = {
  KJFK: {
    id: 'KJFK',
    name: 'John F Kennedy Intl',
    type: 'land',
    runwayCount: 4,
    taxiwayCount: 66,
    pavementCount: 66,
    boundaryCount: 1,
    startupLocationCount: 229,
    frequencyCount: 0,
    helipadCount: 2,
    signCount: 629,
    windsockCount: 5,
    linearFeatureCount: 2746,
    taxiNetworkNodeCount: 1024,
    taxiNetworkEdgeCount: 731,
    totalPavementPoints: 10009,
    totalTaxiwayPoints: 44164,
    totalBoundaryPoints: 54,
  },
  EGLL: {
    id: 'EGLL',
    name: 'London Heathrow',
    type: 'land',
    runwayCount: 2,
    taxiwayCount: 37,
    pavementCount: 37,
    boundaryCount: 1,
    startupLocationCount: 282,
    frequencyCount: 0,
    helipadCount: 1,
    signCount: 623,
    windsockCount: 4,
    linearFeatureCount: 6913,
    taxiNetworkNodeCount: 981,
    taxiNetworkEdgeCount: 459,
    totalPavementPoints: 10898,
    totalTaxiwayPoints: 55095,
    totalBoundaryPoints: 105,
  },
  LFPG: {
    id: 'LFPG',
    name: 'Paris - Charles De Gaulle',
    type: 'land',
    runwayCount: 4,
    taxiwayCount: 158,
    pavementCount: 158,
    boundaryCount: 1,
    startupLocationCount: 513,
    frequencyCount: 0,
    helipadCount: 1,
    signCount: 1369,
    windsockCount: 9,
    linearFeatureCount: 10380,
    taxiNetworkNodeCount: 1748,
    taxiNetworkEdgeCount: 1004,
    totalPavementPoints: 46622,
    totalTaxiwayPoints: 185949,
    totalBoundaryPoints: 205,
  },
  KLAX: {
    id: 'KLAX',
    name: 'Los Angeles Intl',
    type: 'land',
    runwayCount: 4,
    taxiwayCount: 56,
    pavementCount: 56,
    boundaryCount: 1,
    startupLocationCount: 326,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 787,
    windsockCount: 4,
    linearFeatureCount: 3788,
    taxiNetworkNodeCount: 891,
    taxiNetworkEdgeCount: 568,
    totalPavementPoints: 23573,
    totalTaxiwayPoints: 55554,
    totalBoundaryPoints: 47,
  },
  OTHH: {
    id: 'OTHH',
    name: 'Doha Hamad Intl',
    type: 'land',
    runwayCount: 2,
    taxiwayCount: 4,
    pavementCount: 4,
    boundaryCount: 1,
    startupLocationCount: 189,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 520,
    windsockCount: 4,
    linearFeatureCount: 11709,
    taxiNetworkNodeCount: 658,
    taxiNetworkEdgeCount: 488,
    totalPavementPoints: 508,
    totalTaxiwayPoints: 30211,
    totalBoundaryPoints: 49,
  },
  DAAG: {
    id: 'DAAG',
    name: 'Houari Boumediene',
    type: 'land',
    runwayCount: 2,
    taxiwayCount: 27,
    pavementCount: 27,
    boundaryCount: 1,
    startupLocationCount: 81,
    frequencyCount: 0,
    helipadCount: 5,
    signCount: 53,
    windsockCount: 0,
    linearFeatureCount: 936,
    taxiNetworkNodeCount: 380,
    taxiNetworkEdgeCount: 346,
    totalPavementPoints: 1374,
    totalTaxiwayPoints: 16969,
    totalBoundaryPoints: 72,
  },
  OMDB: {
    id: 'OMDB',
    name: 'Dubai Intl',
    type: 'land',
    runwayCount: 2,
    taxiwayCount: 97,
    pavementCount: 97,
    boundaryCount: 1,
    startupLocationCount: 235,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 913,
    windsockCount: 0,
    linearFeatureCount: 3551,
    taxiNetworkNodeCount: 1624,
    taxiNetworkEdgeCount: 584,
    totalPavementPoints: 51010,
    totalTaxiwayPoints: 75881,
    totalBoundaryPoints: 46,
  },
  DAAE: {
    id: 'DAAE',
    name: 'Soummam-Abane Ramdane',
    type: 'land',
    runwayCount: 1,
    taxiwayCount: 5,
    pavementCount: 5,
    boundaryCount: 1,
    startupLocationCount: 5,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 2,
    windsockCount: 0,
    linearFeatureCount: 49,
    taxiNetworkNodeCount: 31,
    taxiNetworkEdgeCount: 33,
    totalPavementPoints: 2207,
    totalTaxiwayPoints: 2207,
    totalBoundaryPoints: 32,
  },
  KFHR: {
    id: 'KFHR',
    name: 'Friday Harbor',
    type: 'land',
    runwayCount: 1,
    taxiwayCount: 52,
    pavementCount: 52,
    boundaryCount: 1,
    startupLocationCount: 82,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 33,
    windsockCount: 2,
    linearFeatureCount: 79,
    taxiNetworkNodeCount: 52,
    taxiNetworkEdgeCount: 57,
    totalPavementPoints: 14551,
    totalTaxiwayPoints: 14551,
    totalBoundaryPoints: 24,
  },
  '5TE': {
    id: '5TE',
    name: 'Tetlin',
    type: 'land',
    runwayCount: 1,
    taxiwayCount: 0,
    pavementCount: 0,
    boundaryCount: 0,
    startupLocationCount: 0,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 0,
    windsockCount: 2,
    linearFeatureCount: 0,
    taxiNetworkNodeCount: 0,
    taxiNetworkEdgeCount: 0,
    totalPavementPoints: 0,
    totalTaxiwayPoints: 0,
    totalBoundaryPoints: 0,
  },
  K29: {
    id: 'K29',
    name: 'Council',
    type: 'land',
    runwayCount: 1,
    taxiwayCount: 1,
    pavementCount: 1,
    boundaryCount: 1,
    startupLocationCount: 2,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 0,
    windsockCount: 2,
    linearFeatureCount: 0,
    taxiNetworkNodeCount: 0,
    taxiNetworkEdgeCount: 0,
    totalPavementPoints: 5,
    totalTaxiwayPoints: 1819,
    totalBoundaryPoints: 7,
  },
  ENQA: {
    id: 'ENQA',
    name: '[H] Troll A Platform',
    type: 'heliport',
    runwayCount: 0,
    taxiwayCount: 0,
    pavementCount: 0,
    boundaryCount: 0,
    startupLocationCount: 0,
    frequencyCount: 0,
    helipadCount: 2,
    signCount: 0,
    windsockCount: 0,
    linearFeatureCount: 0,
    taxiNetworkNodeCount: 0,
    taxiNetworkEdgeCount: 0,
    totalPavementPoints: 0,
    totalTaxiwayPoints: 0,
    totalBoundaryPoints: 0,
  },
  EFPL: {
    id: 'EFPL',
    name: 'Päijät-Hämeen Keskussairaala',
    type: 'heliport',
    runwayCount: 0,
    taxiwayCount: 0,
    pavementCount: 0,
    boundaryCount: 1,
    startupLocationCount: 1,
    frequencyCount: 0,
    helipadCount: 1,
    signCount: 0,
    windsockCount: 0,
    linearFeatureCount: 160,
    taxiNetworkNodeCount: 0,
    taxiNetworkEdgeCount: 0,
    totalPavementPoints: 0,
    totalTaxiwayPoints: 0,
    totalBoundaryPoints: 12,
  },
  AK34: {
    id: 'AK34',
    name: '[S] Kashwitna Lake',
    type: 'seaplane',
    runwayCount: 0,
    taxiwayCount: 0,
    pavementCount: 0,
    boundaryCount: 0,
    startupLocationCount: 0,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 0,
    windsockCount: 0,
    linearFeatureCount: 0,
    taxiNetworkNodeCount: 0,
    taxiNetworkEdgeCount: 0,
    totalPavementPoints: 0,
    totalTaxiwayPoints: 0,
    totalBoundaryPoints: 0,
  },
  PAFK: {
    id: 'PAFK',
    name: '[S] Farewell Lake',
    type: 'seaplane',
    runwayCount: 0,
    taxiwayCount: 0,
    pavementCount: 0,
    boundaryCount: 0,
    startupLocationCount: 0,
    frequencyCount: 0,
    helipadCount: 0,
    signCount: 0,
    windsockCount: 0,
    linearFeatureCount: 0,
    taxiNetworkNodeCount: 0,
    taxiNetworkEdgeCount: 0,
    totalPavementPoints: 0,
    totalTaxiwayPoints: 0,
    totalBoundaryPoints: 0,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const AIRPORT_IDS = [
  'KJFK',
  'EGLL',
  'LFPG',
  'KLAX',
  'OTHH',
  'DAAG',
  'OMDB',
  'DAAE',
  'KFHR',
  '5TE',
  'K29',
  'ENQA',
  'EFPL',
  'AK34',
  'PAFK',
];

describe('Airport structural fingerprints', () => {
  it('fixture contains all 15 airports', () => {
    expect(chunks).toHaveLength(15);
  });

  for (const icao of AIRPORT_IDS) {
    describe(icao, () => {
      it('has expected structure', () => {
        const fp = fingerprints.get(icao);
        expect(fp).toBeDefined();
        expect(fp).toEqual(EXPECTED[icao]);
      });
    });
  }
});
