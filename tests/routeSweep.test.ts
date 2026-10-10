/**
 * Route sweep against the real navigation database: the router and the resolver are run over
 * city pairs chosen to poke one assumption each (the antimeridian, the poles, the North
 * Atlantic tracks, dense European airways, empty oceans) and every plan is held to the same
 * rules a pilot would check. Opt in with `npm run test:sweep`; it skips itself without the
 * database, so CI is untouched.
 */
import { drizzle } from 'drizzle-orm/sql-js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import { autoRoute } from '@/lib/flightplan/builder/autoRouter';
import { cruiseBand, cruiseProblem, isConflict } from '@/lib/flightplan/builder/cruiseAdjust';
import {
  greatCircleNm,
  isEastbound,
  suggestCruiseAltitudeFt,
} from '@/lib/flightplan/builder/geometry';
import {
  type NatMessage,
  parseNatFeed,
  resetOceanicTracksForTests,
  setNatMessages,
} from '@/lib/flightplan/builder/oceanicTracks';
import { routeLinePoints } from '@/lib/flightplan/builder/routeLine';
import { resolveRoute } from '@/lib/flightplan/builder/routeResolver';
import {
  type NatDirection,
  cruiseOnTracks,
  natCrossing,
} from '@/lib/flightplan/builder/trackChoice';
import type { RangeRingCategory } from '@/types/layers';

const DB_PATH =
  process.env.ROUTE_SWEEP_DB ??
  path.join(os.homedir(), 'Library/Application Support/X-Dispatch/xplane-data.db');
const ENABLED = process.env.ROUTE_SWEEP === '1' && fs.existsSync(DB_PATH);

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => os.tmpdir() } }));
vi.mock('@/lib/utils/logger', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
});
const live = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', async () => {
  const schemaModule = await import('@/lib/db/schema');
  return {
    ...schemaModule,
    getDb: () => {
      if (!live.db) throw new Error('route sweep database not loaded');
      return live.db;
    },
    saveDb: () => {},
  };
});

interface Airport {
  icao: string;
  latitude: number;
  longitude: number;
}
const A = (icao: string, latitude: number, longitude: number): Airport => ({
  icao,
  latitude,
  longitude,
});
const AP = {
  KSFO: A('KSFO', 37.62, -122.38),
  VHHH: A('VHHH', 22.31, 113.91),
  RJAA: A('RJAA', 35.76, 140.39),
  KJFK: A('KJFK', 40.64, -73.78),
  NZAA: A('NZAA', -37.01, 174.79),
  SCEL: A('SCEL', -33.39, -70.79),
  EGLL: A('EGLL', 51.47, -0.46),
  PANC: A('PANC', 61.17, -150.0),
  UHPP: A('UHPP', 53.17, 158.45),
  OMDB: A('OMDB', 25.25, 55.36),
  SBGR: A('SBGR', -23.43, -46.47),
  LPPT: A('LPPT', 38.78, -9.14),
  TNCM: A('TNCM', 18.04, -63.11),
  CYYT: A('CYYT', 47.62, -52.75),
  EINN: A('EINN', 52.7, -8.92),
  BIKF: A('BIKF', 63.99, -22.61),
  CYYR: A('CYYR', 53.32, -60.43),
  LFPG: A('LFPG', 49.01, 2.55),
  LFMN: A('LFMN', 43.66, 7.22),
  KLAX: A('KLAX', 33.94, -118.41),
  EGPH: A('EGPH', 55.95, -3.37),
  EGJJ: A('EGJJ', 49.21, -2.2),
  LSZH: A('LSZH', 47.46, 8.55),
  LOWI: A('LOWI', 47.26, 11.34),
  YSSY: A('YSSY', -33.95, 151.18),
  YPPH: A('YPPH', -31.94, 115.97),
  FACT: A('FACT', -33.97, 18.6),
  SAEZ: A('SAEZ', -34.82, -58.54),
  FAOR: A('FAOR', -26.14, 28.25),
  EGTD: A('EGTD', 51.12, -0.54),
  LFQT: A('LFQT', 50.52, 2.52),
};

interface Case {
  from: Airport;
  to: Airport;
  cls: RangeRingCategory;
  /** The North Atlantic panel this pair must get. */
  nat: NatDirection | null;
  /** Whether the route is expected to file a track; a crossing north of the system flies random. */
  track?: boolean;
  why: string;
}
const CASES: Case[] = [
  { from: AP.KSFO, to: AP.VHHH, cls: 'jet', nat: null, why: 'Pacific, crosses 180 westward' },
  { from: AP.RJAA, to: AP.KJFK, cls: 'jet', nat: null, why: 'Pacific, crosses 180 eastward' },
  { from: AP.NZAA, to: AP.SCEL, cls: 'jet', nat: null, why: 'South Pacific, no airways for hours' },
  { from: AP.EGLL, to: AP.RJAA, cls: 'jet', nat: null, why: 'polar great circle' },
  { from: AP.KJFK, to: AP.VHHH, cls: 'jet', nat: null, why: 'over the Arctic' },
  { from: AP.PANC, to: AP.UHPP, cls: 'jet', nat: null, why: 'short hop across the dateline' },
  { from: AP.PANC, to: AP.RJAA, cls: 'jet', nat: null, why: 'Aleutians, across the dateline' },
  {
    from: AP.OMDB,
    to: AP.KJFK,
    cls: 'jet',
    nat: 'westbound',
    track: true,
    why: 'Atlantic from far east',
  },
  {
    from: AP.KJFK,
    to: AP.LFQT,
    cls: 'jet',
    nat: 'eastbound',
    track: true,
    why: 'the classic crossing',
  },
  {
    from: AP.LFQT,
    to: AP.KJFK,
    cls: 'jet',
    nat: 'westbound',
    track: true,
    why: 'the classic crossing back',
  },
  { from: AP.SBGR, to: AP.LPPT, cls: 'jet', nat: null, why: 'South Atlantic, no tracks' },
  { from: AP.TNCM, to: AP.EGLL, cls: 'jet', nat: null, why: 'starts south of the track area' },
  {
    from: AP.CYYT,
    to: AP.EINN,
    cls: 'jet',
    nat: 'eastbound',
    track: true,
    why: 'short crossing, entry by the airport',
  },
  { from: AP.BIKF, to: AP.CYYR, cls: 'jet', nat: 'westbound', why: 'north of the tracks' },
  { from: AP.LFPG, to: AP.LFMN, cls: 'jet', nat: null, why: 'dense European network' },
  { from: AP.KLAX, to: AP.KSFO, cls: 'jet', nat: null, why: 'short domestic jet hop' },
  {
    from: AP.EGPH,
    to: AP.EGJJ,
    cls: 'turboprop',
    nat: null,
    why: 'turboprop at the FL245 boundary',
  },
  { from: AP.LSZH, to: AP.LOWI, cls: 'jet', nat: null, why: 'terrain, high procedure floors' },
  { from: AP.YSSY, to: AP.YPPH, cls: 'jet', nat: null, why: 'sparse domestic airways' },
  { from: AP.FACT, to: AP.SAEZ, cls: 'jet', nat: null, why: 'ocean with no airways' },
  { from: AP.FAOR, to: AP.YPPH, cls: 'jet', nat: null, why: 'Indian Ocean, no airways' },
  { from: AP.EGLL, to: AP.EGTD, cls: 'prop', nat: null, why: 'tiny field, no procedures' },
];

/** The fixture's two track sets, moved to be valid now, so crossings have tracks to use. */
function tracksValidNow(): NatMessage[] {
  const raw = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../src/lib/flightplan/builder/__fixtures__/nat-2026-10-08.json'),
      'utf8'
    )
  ) as unknown;
  const from = new Date(Date.now() - 3_600_000).toISOString();
  const to = new Date(Date.now() + 6 * 3_600_000).toISOString();
  return parseNatFeed(raw, Date.parse('2026-10-08T05:00:00Z')).map((m) => ({
    ...m,
    validFrom: from,
    validTo: to,
    status: 'current',
    tracks: m.tracks.map((t) => ({ ...t, validFrom: from, validTo: to })),
  }));
}

describe.skipIf(!ENABLED)('route sweep on the real navigation database', () => {
  beforeAll(async () => {
    const SQL = await initSqlJs();
    const bytes = fs.readFileSync(DB_PATH);
    live.db = drizzle(new SQL.Database(bytes), { schema });
    resetOceanicTracksForTests();
    setNatMessages(tracksValidNow());
  }, 180_000);
  afterAll(() => {
    resetOceanicTracksForTests();
  });

  it.each(CASES.map((c) => [`${c.from.icao}-${c.to.icao}`, c] as const))(
    '%s plans a legal route (%s)',
    (_name, c) => {
      const eastbound = isEastbound(c.from, c.to);
      const crossing = natCrossing(c.from, c.to);
      expect(crossing, 'North Atlantic panel').toBe(c.nat);

      const distance = greatCircleNm(c.from, c.to);
      let cruise = suggestCruiseAltitudeFt(distance, c.cls, eastbound);
      if (crossing) {
        // The tracks on offer are the fixture's; the panel would show them to the pilot.
        const tracks = tracksValidNow()
          .filter((m) => m.eastbound === (crossing === 'eastbound'))
          .flatMap((m) => m.tracks)
          .map((t) => ({ ...t, points: [] }));
        cruise = cruiseOnTracks(cruise, tracks, eastbound);
      }

      const trace: string[] = [];
      const routed = autoRoute({
        departure: c.from,
        arrival: c.to,
        from: c.from,
        to: c.to,
        cruiseAltitudeFt: cruise,
        trace: (m) => trace.push(m),
      });
      expect(
        routed,
        `auto route found a route at FL${cruise / 100}\n${trace.join('\n')}`
      ).not.toBeNull();

      const resolved = resolveRoute({
        departure: c.from,
        arrival: c.to,
        routeText: routed!.routeText,
        cruiseAltitudeFt: cruise,
      });
      expect(resolved, 'route resolved').not.toBeNull();

      const problems: string[] = [];
      for (const token of resolved!.tokens) {
        if (token.status === 'unknown' || token.status === 'invalid') {
          problems.push(`${token.text}: ${token.issue ?? token.status}`);
        }
        if (token.issue === 'airwayLevel' || token.issue === 'airwayWrongWay') {
          problems.push(`${token.text}: ${token.issue}`);
        }
      }
      const band = cruiseBand(resolved!.levels, null);
      if (isConflict(band))
        problems.push(`level conflict: ${JSON.stringify(resolved!.levelSetters)}`);
      const problem = cruiseProblem(cruise, band, eastbound);
      if (problem === 'belowFloor' || problem === 'aboveCeiling')
        problems.push(`cruise ${problem}`);
      if (c.track && !/NAT[A-Z]/.test(routed!.routeText)) problems.push('no track used');

      // The drawn line must cross the antimeridian the short way.
      const line = routeLinePoints(resolved!.plan.waypoints);
      for (let i = 1; i < line.length; i++) {
        if (Math.abs(line[i]!.longitude - line[i - 1]!.longitude) > 180) {
          problems.push(`line jumps ${line[i - 1]!.longitude} -> ${line[i]!.longitude}`);
        }
      }

      expect(problems, `${routed!.routeText}\nFL${cruise / 100}`).toEqual([]);
    },
    120_000
  );
});
