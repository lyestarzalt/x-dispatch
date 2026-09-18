import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FlightSummary, LandingReport } from '@/types/flightRecorder';
import { FlightStore } from './flightStore';

function summary(id: string, overrides: Partial<FlightSummary> = {}): FlightSummary {
  return {
    id,
    startedAt: 1_700_000_000_000,
    endedAt: null,
    status: 'active',
    aircraft: { icao: 'A320', name: 'A320', livery: null },
    departure: null,
    arrival: null,
    blockTimeSec: 0,
    airTimeSec: 0,
    distanceNm: 0,
    maxAltFt: 0,
    maxGroundspeedKt: 0,
    fuelStartKg: null,
    fuelEndKg: null,
    landing: null,
    landingCount: 0,
    pointCount: 0,
    preview: [],
    ...overrides,
  };
}

const REPORT: LandingReport = {
  at: 1_700_000_100_000,
  lat: 50,
  lon: 8,
  headingDeg: 90,
  groundspeedKt: 120,
  touchdownRateFpm: -180,
  indicatedRateFpm: -190,
  peakG: 1.3,
  pitchDeg: 4,
  rollDeg: 0,
  pitchRateDegSec: 0.3,
  flare: 'veryGood',
  noseRateDegSec: -1,
  floatSec: 6,
  bounces: 0,
  bounceRatesFpm: [],
  rating: 'great',
  runway: null,
};

describe('FlightStore', () => {
  let dir: string;
  let store: FlightStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-flights-'));
    store = new FlightStore(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates, appends and reads a flight back with its track and landings', async () => {
    store.create(summary('f1'));
    await store.appendTrack('f1', [[1, 50, 8, 1000, 120, 90, 0, 900]]);
    await store.appendTrack('f1', [[2, 50.01, 8.01, 1100, 121, 90, 500, 1000]]);
    await store.appendLanding('f1', REPORT);
    store.update(summary('f1', { status: 'complete', endedAt: 5, pointCount: 2 }));

    const detail = store.get('f1');
    expect(detail?.status).toBe('complete');
    expect(detail?.track).toHaveLength(2);
    expect(detail?.track[1]![3]).toBe(1100);
    expect(detail?.landings).toEqual([REPORT]);
  });

  it('lists newest first and survives a fresh instance reading the index', () => {
    store.create(summary('old', { startedAt: 1 }));
    store.create(summary('new', { startedAt: 2 }));
    const again = new FlightStore(dir);
    expect(again.list().map((f) => f.id)).toEqual(['new', 'old']);
  });

  it('rebuilds the index from flight files when it is missing', async () => {
    store.create(summary('a', { startedAt: 10 }));
    store.create(summary('b', { startedAt: 20 }));
    await store.flush('a');
    fs.rmSync(path.join(dir, 'index.json'));
    const rebuilt = new FlightStore(dir);
    expect(rebuilt.list().map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('marks flights left active by a crash as aborted at their last point', async () => {
    store.create(summary('crashed'));
    await store.appendTrack('crashed', [
      [100, 50, 8, 0, 0, 0, 0, 0],
      [200, 50, 8, 0, 0, 0, 0, 0],
    ]);
    const again = new FlightStore(dir);
    const recovered = again.recoverInterrupted();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]!.status).toBe('aborted');
    expect(recovered[0]!.endedAt).toBe(200);
    expect(again.list()[0]!.status).toBe('aborted');
  });

  it('skips a torn last line instead of throwing', async () => {
    store.create(summary('torn'));
    await store.appendTrack('torn', [[1, 50, 8, 0, 0, 0, 0, 0]]);
    fs.appendFileSync(path.join(dir, 'torn.jsonl'), '{"type":"track","poi');
    expect(store.get('torn')?.track).toHaveLength(1);
  });

  it('deletes one flight and clears all', async () => {
    store.create(summary('x'));
    store.create(summary('y'));
    await store.delete('x');
    expect(store.list().map((f) => f.id)).toEqual(['y']);
    expect(fs.existsSync(path.join(dir, 'x.jsonl'))).toBe(false);
    await store.clear();
    expect(store.list()).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'y.jsonl'))).toBe(false);
  });
});
