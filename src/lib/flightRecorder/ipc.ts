import { type BrowserWindow, app, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { broadcast, handle } from '@/lib/remote/handlerRegistry';
import logger from '@/lib/utils/logger';
import { METERS_PER_DEG_LAT } from '@/lib/utils/units/constants';
import type { AircraftHint, FlightAirport, FlightRecorderEvent } from '@/types/flightRecorder';
import { FlightRecorder } from './FlightRecorder';
import { applyFlightEdit, fillAirportNames, newManualFlight } from './flightEdit';
import { FlightStore } from './flightStore';
import { flightsToCsv, parseFlightsCsv } from './logbookCsv';
import type { AirportRunways } from './runwayMatch';

export interface LogbookExportResult {
  path: string;
  count: number;
}

export interface LogbookImportResult {
  imported: number;
  /** Rows whose id is already in the logbook. */
  skipped: number;
  /** Rows that could not be read. */
  rejected: number;
}

export interface FlightRecorderIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  getAirportName: (icao: string) => string | null;
  /** Airports inside a lat/lon box — a database query, not a full-table load. */
  getAirportsInBounds: (
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number
  ) => Array<{ icao: string; name: string; lat: number; lon: number }>;
  getAirportData: (icao: string) => { data: string } | null;
  getDataref: (name: string) => Promise<number | number[] | string | null>;
  attachSink: (sink: {
    onDataref: (name: string, value: number | number[]) => void;
    onConnectionChange: (connected: boolean) => void;
  }) => void;
}

export interface RecorderSink {
  onDataref: (name: string, value: number | number[]) => void;
  onConnectionChange: (connected: boolean) => void;
}

const DEG_PER_M_LAT = 1 / METERS_PER_DEG_LAT;

function decodeStringDataref(value: number | number[] | string | null): string | null {
  if (value === null) return null;
  let text: string;
  if (typeof value === 'string') {
    text = Buffer.from(value, 'base64').toString('utf8');
  } else if (Array.isArray(value)) {
    text = String.fromCharCode(...value.filter((c) => c > 0 && c < 256));
  } else {
    return null;
  }
  const cut = text.indexOf('\0');
  const clean = (cut === -1 ? text : text.slice(0, cut)).trim();
  return clean.length ? clean : null;
}

function liveryNameFromPath(liveryPath: string | null): string | null {
  if (!liveryPath) return null;
  const parts = liveryPath.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : null;
}

export function registerFlightRecorderIPC(deps: FlightRecorderIpcDeps): FlightRecorder {
  const store = new FlightStore(path.join(app.getPath('userData'), 'flights'));
  const recovered = store.recoverInterrupted();
  if (recovered.length) {
    logger.tracker.info(`Marked ${recovered.length} interrupted flight(s) as aborted`);
  }

  const airportsWithin = (lat: number, lon: number, radiusM: number) => {
    const dLat = radiusM * DEG_PER_M_LAT;
    const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    return deps
      .getAirportsInBounds(lat - dLat, lat + dLat, lon - dLon, lon + dLon)
      .map((a) => ({
        ...a,
        d2: (a.lat - lat) ** 2 + ((a.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2,
      }))
      .sort((a, b) => a.d2 - b.d2);
  };

  const nearestAirport = (lat: number, lon: number, radiusM: number): FlightAirport | null => {
    const [first] = airportsWithin(lat, lon, radiusM);
    return first ? { icao: first.icao, name: first.name } : null;
  };

  const airportsNear = (lat: number, lon: number, radiusM: number): AirportRunways[] => {
    const result: AirportRunways[] = [];
    for (const airport of airportsWithin(lat, lon, radiusM).slice(0, 5)) {
      const raw = deps.getAirportData(airport.icao);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw.data) as {
          runways?: Array<{
            width?: number;
            ends?: Array<{ name?: string; latitude?: number; longitude?: number }>;
          }>;
        };
        const runways: AirportRunways['runways'] = [];
        for (const runway of parsed.runways ?? []) {
          const ends = runway.ends ?? [];
          const a = ends[0];
          const b = ends[1];
          if (!a || !b || a.latitude === undefined || b.latitude === undefined) continue;
          runways.push({
            widthM: runway.width ?? 45,
            ends: [
              { name: a.name ?? '', lat: a.latitude, lon: a.longitude ?? 0 },
              { name: b.name ?? '', lat: b.latitude, lon: b.longitude ?? 0 },
            ],
          });
        }
        if (runways.length) result.push({ icao: airport.icao, name: airport.name, runways });
      } catch {
        // Unreadable airport JSON; the landing just goes unmatched.
      }
    }
    return result;
  };

  const readAircraft = async (): Promise<AircraftHint | null> => {
    const [icao, name, livery] = await Promise.all([
      deps.getDataref('sim/aircraft/view/acf_ICAO'),
      deps.getDataref('sim/aircraft/view/acf_ui_name'),
      deps.getDataref('sim/aircraft/view/acf_livery_path'),
    ]);
    const decodedIcao = decodeStringDataref(icao);
    const decodedName = decodeStringDataref(name);
    if (!decodedIcao && !decodedName) return null;
    return {
      icao: decodedIcao,
      name: decodedName,
      livery: liveryNameFromPath(decodeStringDataref(livery)),
    };
  };

  const emit = (event: FlightRecorderEvent) => {
    broadcast('flights:event', event);
  };

  const recorder = new FlightRecorder({
    store,
    emit,
    nearestAirport,
    airportsNear,
    readAircraft,
    log: {
      info: (msg) => logger.tracker.info(msg),
      warn: (msg) => logger.tracker.warn(msg),
    },
  });

  deps.attachSink({
    onDataref: (name, value) => recorder.onDataref(name, value),
    onConnectionChange: (connected) => recorder.onConnectionChange(connected),
  });

  handle('flights:list', () => store.list());
  handle('flights:get', async (_, id: string) => {
    await store.flush(id);
    return store.get(id);
  });
  handle('flights:delete', (_, id: string) => store.delete(id));
  handle('flights:clear', async () => {
    await store.clear();
    // The flight being recorded keeps going; give it a fresh file to append to.
    const live = recorder.liveState().flight;
    if (live) store.create(live);
  });
  handle('flights:liveState', () => recorder.liveState());
  handle('flights:setAircraftHint', (_, hint: AircraftHint | null) => {
    recorder.setAircraftHint(hint);
  });
  handle('flights:setEnabled', (_, enabled: boolean) => {
    recorder.setEnabled(enabled);
  });
  handle('flights:openFolder', () => shell.openPath(store.directory));

  handle('flights:update', async (_, id: string, input: unknown) => {
    const current = store.list().find((f) => f.id === id);
    // The recorder owns a flight until it ends; edits wait for that.
    if (!current || current.status === 'active') return null;
    const edited = fillAirportNames(applyFlightEdit(current, input), deps.getAirportName);
    await store.replace(edited);
    broadcast('flights:event', { type: 'flightUpdated', flight: edited });
    return edited;
  });
  handle('flights:create', (_, input: unknown) => {
    const flight = fillAirportNames(newManualFlight(input), deps.getAirportName);
    store.create(flight);
    broadcast('flights:event', { type: 'flightUpdated', flight });
    return flight;
  });

  const dialogWindow = () => {
    const win = deps.getMainWindow();
    if (win && !win.isDestroyed()) {
      if (!win.isFocused()) win.focus();
      return win;
    }
    return null;
  };
  const csvFilters = [{ name: 'CSV', extensions: ['csv'] }];

  handle('flights:exportCsv', async (): Promise<LogbookExportResult | null> => {
    const flights = store.list().filter((f) => f.status !== 'active');
    const options: Electron.SaveDialogOptions = {
      title: 'Export logbook',
      defaultPath: `x-dispatch-logbook-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: csvFilters,
    };
    const win = dialogWindow();
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, flightsToCsv(flights), 'utf-8');
    logger.tracker.info(`Exported ${flights.length} flight(s) to CSV`);
    return { path: result.filePath, count: flights.length };
  });

  handle('flights:importCsv', async (): Promise<LogbookImportResult | null> => {
    const options: Electron.OpenDialogOptions = {
      title: 'Import logbook',
      properties: ['openFile'],
      filters: csvFilters,
    };
    const win = dialogWindow();
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    const parsed = parseFlightsCsv(await fs.promises.readFile(file, 'utf-8'));
    const known = new Set(store.list().map((f) => f.id));
    let imported = 0;
    let skipped = 0;
    for (const flight of parsed.flights) {
      if (known.has(flight.id)) {
        skipped += 1;
        continue;
      }
      store.create(fillAirportNames(flight, deps.getAirportName));
      known.add(flight.id);
      imported += 1;
    }
    if (imported > 0)
      broadcast('flights:event', { type: 'flightUpdated', flight: parsed.flights[0]! });
    logger.tracker.info(
      `Imported ${imported} flight(s) from CSV, ${skipped} already present, ${parsed.rejectedLines.length} unreadable`
    );
    return { imported, skipped, rejected: parsed.rejectedLines.length };
  });

  return recorder;
}
