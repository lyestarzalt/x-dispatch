import { describe, expect, it, vi } from 'vitest';
import type { FlightRecorderEvent, FlightSummary } from '@/types/flightRecorder';
import { FlightRecorder } from './FlightRecorder';
import type { FlightStore } from './flightStore';
import { RECORDER_DATAREFS, type SimFrame } from './frames';
import { approachFrames, frame } from './testFrames';

function fakeStore() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    appendTrack: vi.fn(() => Promise.resolve()),
    appendLanding: vi.fn(() => Promise.resolve()),
  } as unknown as FlightStore & {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    appendTrack: ReturnType<typeof vi.fn>;
    appendLanding: ReturnType<typeof vi.fn>;
  };
}

let wallClock = 0;

function feed(recorder: FlightRecorder, f: SimFrame): void {
  wallClock = f.wallT;
  recorder.onDataref(RECORDER_DATAREFS.latitude, f.lat);
  recorder.onDataref(RECORDER_DATAREFS.longitude, f.lon);
  recorder.onDataref(RECORDER_DATAREFS.elevation, f.altM);
  recorder.onDataref(RECORDER_DATAREFS.agl, f.aglM);
  recorder.onDataref(RECORDER_DATAREFS.groundspeed, f.groundspeedMs);
  recorder.onDataref(RECORDER_DATAREFS.heading, f.headingDeg);
  recorder.onDataref(RECORDER_DATAREFS.verticalSpeed, f.vsFpm);
  recorder.onDataref(RECORDER_DATAREFS.gNormal, f.gNormal);
  recorder.onDataref(RECORDER_DATAREFS.onGroundAny, f.onGroundAny ? 1 : 0);
  recorder.onDataref(RECORDER_DATAREFS.onGroundAll, f.onGroundAll ? 1 : 0);
  recorder.onDataref(RECORDER_DATAREFS.pitchRate, f.pitchRateDegSec);
  recorder.onDataref(RECORDER_DATAREFS.pitch, f.pitchDeg);
  recorder.onDataref(RECORDER_DATAREFS.roll, f.rollDeg);
  recorder.onDataref(RECORDER_DATAREFS.paused, f.paused ? 1 : 0);
  recorder.onDataref(RECORDER_DATAREFS.replay, f.replay ? 1 : 0);
  if (f.fuelKg !== null) recorder.onDataref(RECORDER_DATAREFS.fuelTotal, f.fuelKg);
  recorder.onDataref(RECORDER_DATAREFS.flightTime, f.simT);
}

const AIRPORT = { icao: 'EDDF', name: 'Frankfurt' };

function setup(readAircraft?: () => Promise<{ icao: string; name: string; livery: null }>) {
  const store = fakeStore();
  const events: FlightRecorderEvent[] = [];
  const recorder = new FlightRecorder({
    store,
    emit: (e) => events.push(e),
    nearestAirport: () => AIRPORT,
    airportsNear: () => [],
    readAircraft,
    now: () => wallClock,
  });
  return { store, events, recorder };
}

describe('FlightRecorder', () => {
  it('opens a flight on first movement, records the track and closes it when parked', () => {
    const { store, events, recorder } = setup();
    const ground = { onGroundAny: true, onGroundAll: true, aglM: 0, altM: 110 };
    let t = 0;
    for (let i = 0; i < 20; i++)
      feed(recorder, frame({ ...ground, simT: (t += 0.5), groundspeedMs: 0 }));
    for (let i = 0; i < 40; i++)
      feed(recorder, frame({ ...ground, simT: (t += 0.5), groundspeedMs: 8 }));
    for (let i = 0; i < 60; i++) {
      feed(
        recorder,
        frame({ onGroundAny: false, onGroundAll: false, aglM: 500, altM: 600, simT: (t += 0.5) })
      );
    }
    for (let i = 0; i < 10; i++)
      feed(recorder, frame({ ...ground, simT: (t += 0.5), groundspeedMs: 60 }));
    for (let i = 0; i < 20; i++)
      feed(recorder, frame({ ...ground, simT: (t += 0.5), groundspeedMs: 5 }));
    for (let i = 0; i < 240; i++)
      feed(recorder, frame({ ...ground, simT: (t += 0.5), groundspeedMs: 0 }));

    const started = events.find((e) => e.type === 'flightStarted');
    expect(started).toBeDefined();
    expect(store.create).toHaveBeenCalledTimes(1);
    const ended = events.find((e) => e.type === 'flightEnded') as
      { type: 'flightEnded'; flight: FlightSummary } | undefined;
    expect(ended).toBeDefined();
    expect(ended!.flight.status).toBe('complete');
    expect(ended!.flight.departure).toEqual(AIRPORT);
    expect(ended!.flight.arrival).toEqual(AIRPORT);
    expect(ended!.flight.pointCount).toBeGreaterThan(100);
    expect(ended!.flight.airTimeSec).toBeGreaterThan(25);
    expect(ended!.flight.blockTimeSec).toBeGreaterThan(ended!.flight.airTimeSec);
    expect(ended!.flight.maxAltFt).toBe(Math.round(600 * 3.28084));
    const trackEvents = events.filter((e) => e.type === 'track');
    expect(trackEvents.length).toBeGreaterThan(0);
    expect(store.appendTrack).toHaveBeenCalled();
    expect(recorder.liveState().flight).toBeNull();
  });

  it('attaches the landing report to the flight and emits it', () => {
    const { store, events, recorder } = setup();
    let t = 0;
    for (let i = 0; i < 60; i++) {
      feed(
        recorder,
        frame({
          onGroundAny: false,
          onGroundAll: false,
          aglM: 300,
          altM: 400,
          vsFpm: -700,
          simT: (t += 0.5),
        })
      );
    }
    for (const f of approachFrames({ descentFpm: 220, startSimT: t + 0.1, rolloutSec: 6 }))
      feed(recorder, f);

    const landing = events.find((e) => e.type === 'landing');
    expect(landing).toBeDefined();
    expect(store.appendLanding).toHaveBeenCalledTimes(1);
    const live = recorder.liveState();
    expect(live.flight?.landingCount).toBe(1);
    expect(live.flight?.landing?.rating).toBe('great');
    expect(live.flight?.arrival).toEqual(AIRPORT);
  });

  it('aborts the open flight when X-Plane disconnects mid-air', () => {
    const { events, recorder } = setup();
    let t = 0;
    for (let i = 0; i < 10; i++) {
      feed(
        recorder,
        frame({ onGroundAny: false, onGroundAll: false, aglM: 2000, simT: (t += 0.5) })
      );
    }
    recorder.onConnectionChange(false);
    const ended = events.find((e) => e.type === 'flightEnded') as { flight: FlightSummary };
    expect(ended.flight.status).toBe('aborted');
    expect(recorder.liveState().flight).toBeNull();
  });

  it('fills in the aircraft from the REST lookup when no hint was given', async () => {
    const { events, recorder } = setup(async () => ({
      icao: 'B738',
      name: 'Boeing 737-800',
      livery: null,
    }));
    let t = 0;
    for (let i = 0; i < 10; i++) {
      feed(
        recorder,
        frame({ onGroundAny: false, onGroundAll: false, aglM: 2000, simT: (t += 0.5) })
      );
    }
    await recorder.settle();
    const updated = events.find((e) => e.type === 'flightUpdated') as { flight: FlightSummary };
    expect(updated.flight.aircraft.icao).toBe('B738');
  });

  it('prefers the launch hint over the REST lookup', async () => {
    const lookup = vi.fn(async () => ({ icao: 'B738', name: 'x', livery: null }));
    const { recorder } = setup(lookup);
    recorder.setAircraftHint({ icao: 'A21N', name: 'A321neo', livery: 'House' });
    let t = 0;
    for (let i = 0; i < 10; i++) {
      feed(
        recorder,
        frame({ onGroundAny: false, onGroundAll: false, aglM: 2000, simT: (t += 0.5) })
      );
    }
    await recorder.settle();
    expect(lookup).not.toHaveBeenCalled();
    expect(recorder.liveState().flight?.aircraft.icao).toBe('A21N');
  });

  it('records nothing while disabled', () => {
    const { events, recorder } = setup();
    recorder.setEnabled(false);
    let t = 0;
    for (let i = 0; i < 10; i++) {
      feed(
        recorder,
        frame({ onGroundAny: false, onGroundAll: false, aglM: 2000, simT: (t += 0.5) })
      );
    }
    expect(events).toEqual([]);
  });
});
