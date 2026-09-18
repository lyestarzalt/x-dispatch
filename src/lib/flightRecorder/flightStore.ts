import * as fs from 'fs';
import * as path from 'path';
import type {
  FlightDetail,
  FlightSummary,
  LandingReport,
  TrackPointTuple,
} from '@/types/flightRecorder';

const INDEX_FILE = 'index.json';
const INDEX_VERSION = 1;

interface IndexFile {
  version: number;
  flights: FlightSummary[];
}

type FlightLine =
  | { type: 'meta'; flight: FlightSummary }
  | { type: 'track'; points: TrackPointTuple[] }
  | { type: 'landing'; report: LandingReport };

/**
 * Flights live as one append-only JSON-lines file each plus a small index of
 * summaries. The app database is sql.js, which rewrites the whole file on
 * every save, so streaming samples into it was never an option.
 */
export class FlightStore {
  private index: IndexFile | null = null;
  private queues = new Map<string, Promise<void>>();

  constructor(private readonly dir: string) {}

  get directory(): string {
    return this.dir;
  }

  /** Flights still marked active from a previous run were cut short. */
  recoverInterrupted(): FlightSummary[] {
    const index = this.readIndex();
    const recovered: FlightSummary[] = [];
    for (const flight of index.flights) {
      if (flight.status !== 'active') continue;
      flight.status = 'aborted';
      flight.endedAt = flight.endedAt ?? this.lastPointTime(flight.id) ?? flight.startedAt;
      recovered.push(flight);
    }
    if (recovered.length) this.writeIndex();
    return recovered;
  }

  list(): FlightSummary[] {
    return this.readIndex().flights.map((f) => ({ ...f }));
  }

  get(id: string): FlightDetail | null {
    const summary = this.readIndex().flights.find((f) => f.id === id);
    if (!summary) return null;
    const detail: FlightDetail = { ...summary, track: [], landings: [] };
    for (const line of this.readLines(id)) {
      if (line.type === 'track') detail.track.push(...line.points);
      else if (line.type === 'landing') detail.landings.push(line.report);
    }
    return detail;
  }

  create(flight: FlightSummary): void {
    const index = this.readIndex();
    index.flights = [flight, ...index.flights.filter((f) => f.id !== flight.id)];
    this.writeIndex();
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath(flight.id), this.serialize({ type: 'meta', flight }));
  }

  update(flight: FlightSummary): void {
    const index = this.readIndex();
    const at = index.flights.findIndex((f) => f.id === flight.id);
    if (at === -1) index.flights.unshift(flight);
    else index.flights[at] = flight;
    this.writeIndex();
  }

  appendTrack(id: string, points: TrackPointTuple[]): Promise<void> {
    if (points.length === 0) return Promise.resolve();
    return this.enqueue(id, this.serialize({ type: 'track', points }));
  }

  appendLanding(id: string, report: LandingReport): Promise<void> {
    return this.enqueue(id, this.serialize({ type: 'landing', report }));
  }

  /** Resolves once every queued write for the flight has landed on disk. */
  flush(id: string): Promise<void> {
    return this.queues.get(id) ?? Promise.resolve();
  }

  async delete(id: string): Promise<void> {
    await this.flush(id);
    const index = this.readIndex();
    index.flights = index.flights.filter((f) => f.id !== id);
    this.writeIndex();
    fs.rmSync(this.filePath(id), { force: true });
  }

  async clear(): Promise<void> {
    const index = this.readIndex();
    for (const flight of index.flights) {
      await this.flush(flight.id);
      fs.rmSync(this.filePath(flight.id), { force: true });
    }
    index.flights = [];
    this.writeIndex();
  }

  private enqueue(id: string, line: string): Promise<void> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => fs.promises.appendFile(this.filePath(id), line));
    this.queues.set(id, next);
    return next;
  }

  private serialize(line: FlightLine): string {
    return JSON.stringify(line) + '\n';
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.jsonl`);
  }

  private *readLines(id: string): Generator<FlightLine> {
    let content: string;
    try {
      content = fs.readFileSync(this.filePath(id), 'utf-8');
    } catch {
      return;
    }
    for (const raw of content.split('\n')) {
      if (!raw) continue;
      try {
        yield JSON.parse(raw) as FlightLine;
      } catch {
        // A partial last line after a crash; nothing after it is usable either.
        return;
      }
    }
  }

  private lastPointTime(id: string): number | null {
    let last: number | null = null;
    for (const line of this.readLines(id)) {
      if (line.type === 'track' && line.points.length) {
        last = line.points[line.points.length - 1]![0];
      }
    }
    return last;
  }

  private readIndex(): IndexFile {
    if (this.index) return this.index;
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(this.dir, INDEX_FILE), 'utf-8')
      ) as IndexFile;
      if (parsed.version === INDEX_VERSION && Array.isArray(parsed.flights)) {
        this.index = parsed;
        return parsed;
      }
    } catch {
      // Missing or corrupt index; flights on disk stay, the index is rebuilt below.
    }
    this.index = { version: INDEX_VERSION, flights: this.rebuildFromFiles() };
    return this.index;
  }

  private rebuildFromFiles(): FlightSummary[] {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir).filter((n) => n.endsWith('.jsonl'));
    } catch {
      return [];
    }
    const flights: FlightSummary[] = [];
    for (const name of names) {
      const id = name.slice(0, -'.jsonl'.length);
      const first = this.readLines(id).next().value as FlightLine | undefined;
      if (first?.type === 'meta') flights.push(first.flight);
    }
    return flights.sort((a, b) => b.startedAt - a.startedAt);
  }

  private writeIndex(): void {
    if (!this.index) return;
    fs.mkdirSync(this.dir, { recursive: true });
    const target = path.join(this.dir, INDEX_FILE);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.index));
    fs.renameSync(tmp, target);
  }
}
