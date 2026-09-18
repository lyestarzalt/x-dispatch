import { BrowserWindow, app, ipcMain, shell } from 'electron';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { AircraftHint, FlightAirport, FlightRecorderEvent } from '@/types/flightRecorder';
import { FlightRecorder } from './FlightRecorder';
import { FlightStore } from './flightStore';
import type { AirportRunways } from './runwayMatch';

export interface FlightRecorderIpcDeps {
  getAllAirports: () => Array<{ icao: string; name: string; lat: number; lon: number }>;
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

const DEG_PER_M_LAT = 1 / 111_320;

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
      .getAllAirports()
      .filter((a) => Math.abs(a.lat - lat) <= dLat && Math.abs(a.lon - lon) <= dLon)
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
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('flights:event', event);
    }
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

  ipcMain.handle('flights:list', () => store.list());
  ipcMain.handle('flights:get', async (_, id: string) => {
    await store.flush(id);
    return store.get(id);
  });
  ipcMain.handle('flights:delete', (_, id: string) => store.delete(id));
  ipcMain.handle('flights:clear', () => store.clear());
  ipcMain.handle('flights:liveState', () => recorder.liveState());
  ipcMain.handle('flights:setAircraftHint', (_, hint: AircraftHint | null) => {
    recorder.setAircraftHint(hint);
  });
  ipcMain.handle('flights:setEnabled', (_, enabled: boolean) => {
    recorder.setEnabled(enabled);
  });
  ipcMain.handle('flights:openFolder', () => shell.openPath(store.directory));

  return recorder;
}
