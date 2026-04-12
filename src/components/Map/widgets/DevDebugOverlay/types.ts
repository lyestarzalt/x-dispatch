import type { LayerInspectorGroup } from '../layerInspector';

export interface DebugStats {
  appVersion: string;
  env: string;
  electronVersion: string;
  chromeVersion: string;
  zoom: number;
  pitch: number;
  projection: string;
  center: [number, number];
  fps: number;
  layerCount: number;
  sourceCount: number;
  airportICAO: string | null;
  airportSource: string;
  inspectorData: LayerInspectorGroup[];
  terrainActive: boolean;
  terrainSourceLoaded: boolean;
  hillshadeSourceLoaded: boolean;
  tileCacheEntries: number;
  tileCacheSize: string;
  tileCacheHitRate: string;
  xplaneWs: string;
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;
  rendererHeapMB: string;
  mainRssMB: string;
  mainHeapMB: string;
  ipcLatencyMs: number;
  xplanePath: string;
  configPath: string;
  logPath: string;
}

export type MapRef = React.RefObject<maplibregl.Map | null>;
export type TabId = 'map' | 'layers' | 'network' | 'perf' | 'state' | 'db';

export interface DetachedPanel {
  id: TabId;
  x: number;
  y: number;
}

export const TABS: { id: TabId; label: string; tip: string }[] = [
  { id: 'map', label: 'Map', tip: 'Map state, airport, terrain' },
  { id: 'layers', label: 'Layers', tip: 'Layer inspector — click layers to toggle visibility' },
  { id: 'network', label: 'Net', tip: 'X-Plane WebSocket, VATSIM, IVAO' },
  { id: 'perf', label: 'Perf', tip: 'Memory, IPC latency, FPS, cache' },
  { id: 'state', label: 'State', tip: 'App state — stores, settings, selections' },
  { id: 'db', label: 'DB', tip: 'Database tables, schema, and row preview' },
];
