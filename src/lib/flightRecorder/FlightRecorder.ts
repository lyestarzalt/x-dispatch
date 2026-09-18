import { haversineDistance } from '@/lib/utils/geomath';
import type {
  AircraftHint,
  FlightAirport,
  FlightPhase,
  FlightRecorderEvent,
  FlightSummary,
  LandingReport,
  LiveRecorderState,
  TrackPointTuple,
} from '@/types/flightRecorder';
import type { FlightStore } from './flightStore';
import { FrameAssembler, type SimFrame } from './frames';
import { LandingDetector } from './landingDetector';
import { FlightPhaseMachine } from './phaseMachine';
import { type AirportRunways, matchRunway } from './runwayMatch';

const M_TO_FT = 3.28084;
const MS_TO_KT = 1.94384;
const M_TO_NM = 1 / 1852;
const TRACK_INTERVAL_S = 1;
const FLUSH_INTERVAL_MS = 1000;
const PREVIEW_EVERY = 30;
const AIRPORT_SEARCH_RADIUS_M = 6000;

export interface FlightRecorderDeps {
  store: FlightStore;
  emit: (event: FlightRecorderEvent) => void;
  nearestAirport: (lat: number, lon: number, radiusM: number) => FlightAirport | null;
  airportsNear: (lat: number, lon: number, radiusM: number) => AirportRunways[];
  /** Resolves the loaded aircraft over the REST API; null when unavailable. */
  readAircraft?: () => Promise<AircraftHint | null>;
  now?: () => number;
  log?: { info: (msg: string) => void; warn: (msg: string) => void };
}

/**
 * Consumes raw dataref updates from the WebSocket client and turns them into
 * flight records, track points and landing reports. Lives in the main
 * process so recording continues whatever the renderer is doing.
 */
export class FlightRecorder {
  private readonly assembler: FrameAssembler;
  private phases = new FlightPhaseMachine();
  private landing = new LandingDetector();
  private enabled = true;
  private hint: AircraftHint | null = null;

  private flight: FlightSummary | null = null;
  private track: TrackPointTuple[] = [];
  private pending: TrackPointTuple[] = [];
  private lastFlushAt = 0;
  private lastPointSimT = -Infinity;
  private lastFrame: SimFrame | null = null;
  private airTimeMs = 0;
  private aircraftLookup: Promise<void> | null = null;

  constructor(private readonly deps: FlightRecorderDeps) {
    this.assembler = new FrameAssembler(deps.now ?? Date.now);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.endFlight('aborted');
  }

  setAircraftHint(hint: AircraftHint | null): void {
    this.hint = hint;
    if (this.flight && hint && (hint.icao || hint.name)) {
      this.flight.aircraft = { icao: hint.icao, name: hint.name, livery: hint.livery };
      this.persistSummary('flightUpdated');
    }
  }

  onDataref(name: string, value: number | number[]): void {
    const frame = this.assembler.update(name, value);
    if (frame && this.enabled) this.process(frame);
  }

  onConnectionChange(connected: boolean): void {
    if (connected) return;
    this.endFlight(this.phases.current === 'parked' ? 'complete' : 'aborted');
    this.phases = new FlightPhaseMachine();
    this.landing = new LandingDetector();
    this.assembler.reset();
    this.lastFrame = null;
  }

  liveState(): LiveRecorderState {
    return {
      flight: this.flight ? { ...this.flight } : null,
      phase: this.phases.current,
      track: this.track.slice(),
    };
  }

  private process(frame: SimFrame): void {
    const update = this.phases.push(frame);
    for (const event of update.events) {
      if (event === 'flightEnd') this.endFlight('complete', frame);
      else if (event === 'flightStart') this.startFlight(frame);
    }
    if (update.changed && this.flight) {
      this.deps.emit({ type: 'phase', flightId: this.flight.id, phase: update.phase });
    }

    if (this.flight && !frame.paused && !frame.replay) {
      this.accumulate(frame);
      if (frame.simT - this.lastPointSimT >= TRACK_INTERVAL_S) {
        this.addPoint(frame);
      }
      if (frame.wallT - this.lastFlushAt >= FLUSH_INTERVAL_MS) this.flushPoints();
    }

    const report = this.landing.push(frame);
    if (report) this.recordLanding(report);

    this.lastFrame = frame;
  }

  private accumulate(frame: SimFrame): void {
    const prev = this.lastFrame;
    if (!prev || prev.paused || prev.replay) return;
    const dtMs = Math.max(0, frame.wallT - prev.wallT);
    if (!frame.onGroundAny) this.airTimeMs += dtMs;
  }

  private addPoint(frame: SimFrame): void {
    const flight = this.flight!;
    const point: TrackPointTuple = [
      frame.wallT,
      round(frame.lat, 6),
      round(frame.lon, 6),
      Math.round(frame.altM * M_TO_FT),
      Math.round(frame.groundspeedMs * MS_TO_KT),
      Math.round(frame.headingDeg),
      Math.round(frame.vsFpm),
      Math.round(frame.aglM * M_TO_FT),
    ];
    const last = this.track[this.track.length - 1];
    if (last) {
      flight.distanceNm += haversineDistance(last[1], last[2], point[1], point[2]) * M_TO_NM;
    }
    flight.maxAltFt = Math.max(flight.maxAltFt, point[3]);
    flight.maxGroundspeedKt = Math.max(flight.maxGroundspeedKt, point[4]);
    flight.pointCount += 1;
    if (flight.pointCount % PREVIEW_EVERY === 1) flight.preview.push([point[1], point[2]]);
    this.track.push(point);
    this.pending.push(point);
    this.lastPointSimT = frame.simT;
  }

  private flushPoints(): void {
    this.lastFlushAt = this.deps.now?.() ?? Date.now();
    if (!this.flight || this.pending.length === 0) return;
    const points = this.pending;
    this.pending = [];
    void this.deps.store.appendTrack(this.flight.id, points);
    this.deps.emit({ type: 'track', flightId: this.flight.id, points });
  }

  private startFlight(frame: SimFrame): void {
    if (this.flight) this.endFlight('complete', frame);
    const id = `${frame.wallT.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const departure = frame.onGroundAny
      ? this.deps.nearestAirport(frame.lat, frame.lon, AIRPORT_SEARCH_RADIUS_M)
      : null;
    this.flight = {
      id,
      startedAt: frame.wallT,
      endedAt: null,
      status: 'active',
      aircraft: {
        icao: this.hint?.icao ?? null,
        name: this.hint?.name ?? null,
        livery: this.hint?.livery ?? null,
      },
      departure,
      arrival: null,
      blockTimeSec: 0,
      airTimeSec: 0,
      distanceNm: 0,
      maxAltFt: 0,
      maxGroundspeedKt: 0,
      fuelStartKg: frame.fuelKg,
      fuelEndKg: null,
      landing: null,
      landingCount: 0,
      pointCount: 0,
      preview: [],
    };
    this.track = [];
    this.pending = [];
    this.airTimeMs = 0;
    this.lastPointSimT = -Infinity;
    this.lastFlushAt = frame.wallT;
    this.deps.store.create(this.flight);
    this.deps.emit({ type: 'flightStarted', flight: { ...this.flight } });
    this.deps.log?.info(`Flight ${id} started${departure ? ` at ${departure.icao}` : ''}`);
    this.addPoint(frame);
    this.lookupAircraft(id);
  }

  private lookupAircraft(flightId: string): void {
    if (!this.deps.readAircraft || (this.hint && (this.hint.icao || this.hint.name))) return;
    this.aircraftLookup = this.deps
      .readAircraft()
      .then((aircraft) => {
        if (!aircraft || !this.flight || this.flight.id !== flightId) return;
        if (!aircraft.icao && !aircraft.name) return;
        this.flight.aircraft = aircraft;
        this.persistSummary('flightUpdated');
      })
      .catch(() => undefined);
  }

  private recordLanding(report: LandingReport): void {
    if (!this.flight) return;
    const runway = matchRunway(
      { lat: report.lat, lon: report.lon, headingDeg: report.headingDeg },
      this.deps.airportsNear(report.lat, report.lon, AIRPORT_SEARCH_RADIUS_M)
    );
    report.runway = runway;
    this.flight.landing = report;
    this.flight.landingCount += 1;
    this.flight.arrival = runway
      ? { icao: runway.icao, name: runway.airportName }
      : this.deps.nearestAirport(report.lat, report.lon, AIRPORT_SEARCH_RADIUS_M);
    void this.deps.store.appendLanding(this.flight.id, report);
    this.deps.emit({ type: 'landing', flightId: this.flight.id, report });
    this.persistSummary('flightUpdated');
    this.deps.log?.info(
      `Landing ${report.touchdownRateFpm} fpm, ${report.peakG.toFixed(2)} g` +
        (runway ? ` on ${runway.icao} ${runway.runway}` : '')
    );
  }

  private endFlight(status: 'complete' | 'aborted', frame: SimFrame | null = null): void {
    const flight = this.flight;
    if (!flight) return;
    const last = frame ?? this.lastFrame;
    if (last && !frame) this.accumulate(last);
    this.flushPoints();
    flight.endedAt = last?.wallT ?? this.deps.now?.() ?? Date.now();
    flight.blockTimeSec = Math.max(0, Math.round((flight.endedAt - flight.startedAt) / 1000));
    flight.airTimeSec = Math.round(this.airTimeMs / 1000);
    flight.fuelEndKg = last?.fuelKg ?? null;
    flight.status = flight.pointCount < 2 ? 'aborted' : status;
    if (!flight.arrival && last?.onGroundAny) {
      flight.arrival = this.deps.nearestAirport(last.lat, last.lon, AIRPORT_SEARCH_RADIUS_M);
    }
    this.flight = null;
    this.track = [];
    this.pending = [];
    this.deps.store.update(flight);
    this.deps.emit({ type: 'flightEnded', flight: { ...flight } });
    this.deps.log?.info(
      `Flight ${flight.id} ${flight.status}: ${flight.distanceNm.toFixed(0)} nm, ` +
        `${flight.blockTimeSec}s block, ${flight.landingCount} landing(s)`
    );
  }

  private persistSummary(type: 'flightUpdated'): void {
    if (!this.flight) return;
    this.deps.store.update(this.flight);
    this.deps.emit({ type, flight: { ...this.flight } });
  }

  /** Test hook: waits for the aircraft lookup started at flight start. */
  async settle(): Promise<void> {
    await this.aircraftLookup;
  }

  get phase(): FlightPhase {
    return this.phases.current;
  }
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
