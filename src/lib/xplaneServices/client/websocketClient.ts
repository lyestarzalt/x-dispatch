import WebSocket from 'ws';
import logger from '@/lib/utils/logger';
import type { AircraftCategory, PlaneState } from '@/types/xplane';

const DEFAULT_PORT = 8086;
const RECONNECT_DELAY = 3000;
const RESOLVE_TIMEOUT = 5000;

const METERS_TO_FEET = 3.28084;
const MPS_TO_KNOTS = 1.94384;

const DATAREF_NAMES = [
  'sim/flightmodel/position/latitude',
  'sim/flightmodel/position/longitude',
  'sim/flightmodel/position/elevation',
  'sim/flightmodel/position/psi',
  'sim/flightmodel/position/groundspeed',
  'sim/flightmodel/position/indicated_airspeed',
  'sim/flightmodel/position/y_agl',
  'sim/cockpit2/gauges/indicators/vvi_fpm_pilot',
  'sim/aircraft2/metadata/is_helicopter',
  'sim/aircraft2/metadata/is_airliner',
  'sim/aircraft2/metadata/is_cargo',
  'sim/aircraft2/metadata/is_general_aviation',
  'sim/aircraft2/metadata/is_glider',
  'sim/aircraft2/metadata/is_military',
  'sim/aircraft2/metadata/is_ultralight',
  'sim/aircraft2/metadata/is_seaplane',
  'sim/aircraft2/metadata/is_vtol',
];

// Maps metadata dataref names to aircraft categories (checked in priority order)
const METADATA_CATEGORY_MAP: [string, AircraftCategory][] = [
  ['sim/aircraft2/metadata/is_helicopter', 'helicopter'],
  ['sim/aircraft2/metadata/is_military', 'military'],
  ['sim/aircraft2/metadata/is_cargo', 'cargo'],
  ['sim/aircraft2/metadata/is_airliner', 'airliner'],
  ['sim/aircraft2/metadata/is_glider', 'glider'],
  ['sim/aircraft2/metadata/is_vtol', 'vtol'],
  ['sim/aircraft2/metadata/is_ultralight', 'ultralight'],
  ['sim/aircraft2/metadata/is_seaplane', 'seaplane'],
  ['sim/aircraft2/metadata/is_general_aviation', 'ga'],
];

interface DatarefInfo {
  id: number;
  name: string;
}

const DATAREF_MAPPING: Record<string, keyof PlaneState> = {
  'sim/flightmodel/position/latitude': 'latitude',
  'sim/flightmodel/position/longitude': 'longitude',
  'sim/flightmodel/position/elevation': 'altitudeMSL',
  'sim/flightmodel/position/psi': 'heading',
  'sim/flightmodel/position/groundspeed': 'groundspeed',
  'sim/flightmodel/position/indicated_airspeed': 'indicatedAirspeed',
  'sim/flightmodel/position/y_agl': 'altitudeAGL',
  'sim/cockpit2/gauges/indicators/vvi_fpm_pilot': 'verticalSpeed',
};

type StateUpdateCallback = (state: PlaneState) => void;
type ConnectionCallback = (connected: boolean) => void;

export class XPlaneWebSocketClient {
  private ws: WebSocket | null = null;
  private port: number;
  private onStateUpdate: StateUpdateCallback | null = null;
  private onConnectionChange: ConnectionCallback | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentState: Partial<PlaneState> = {};
  private isConnecting = false;
  private shouldReconnect = true;
  private datarefIdToName: Map<number, string> = new Map();
  private resolvedDatarefs: DatarefInfo[] = [];
  private metadataFlags: Map<string, number> = new Map();

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  connect(onStateUpdate: StateUpdateCallback, onConnectionChange?: ConnectionCallback): void {
    this.onStateUpdate = onStateUpdate;
    this.onConnectionChange = onConnectionChange ?? null;
    this.shouldReconnect = true;
    this.resolveDatarefsAndConnect();
  }

  private async resolveDatarefsAndConnect(): Promise<void> {
    if (this.resolvedDatarefs.length === 0) {
      try {
        const resolved = await this.resolveDatarefIds();
        this.resolvedDatarefs = resolved;
        this.datarefIdToName.clear();
        for (const dr of resolved) {
          this.datarefIdToName.set(dr.id, dr.name);
        }
      } catch {
        this.scheduleReconnect();
        return;
      }
    }
    this.createConnection();
  }

  private async resolveDatarefIds(): Promise<DatarefInfo[]> {
    const results: DatarefInfo[] = [];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT);

    try {
      const filterParams = DATAREF_NAMES.map(
        (name) => `filter[name]=${encodeURIComponent(name)}`
      ).join('&');

      const url = `http://localhost:${this.port}/api/v3/datarefs?${filterParams}&fields=id,name`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.id && item.name) {
            results.push({ id: item.id, name: item.name });
          }
        }
      }
    } catch {
      clearTimeout(timeoutId);
      throw new Error('Failed to resolve datarefs');
    }

    return results;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentState = {};
    this.metadataFlags.clear();
    this.resolvedDatarefs = [];
    this.datarefIdToName.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getPort(): number {
    return this.port;
  }

  /**
   * Force reconnect - closes existing connection and reconnects fresh.
   * Clears all cached state to ensure fresh data from simulator.
   */
  forceReconnect(): void {
    logger.tracker.info('Force reconnect requested');

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close existing connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear all cached state
    this.currentState = {};
    this.isConnecting = false;

    // Reconnect immediately if we should be connected
    if (this.shouldReconnect && this.onStateUpdate) {
      this.resolveDatarefsAndConnect();
    }
  }

  private createConnection(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}/api/v3`);

      this.ws.on('open', () => {
        this.isConnecting = false;
        logger.tracker.info('WebSocket connected');
        this.onConnectionChange?.(true);
        this.subscribeToDatarefs();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'dataref_update_values') {
            this.handleDatarefUpdate(msg.data);
          }
        } catch {
          // ignore
        }
      });

      this.ws.on('error', () => {
        this.isConnecting = false;
      });

      this.ws.on('close', () => {
        this.isConnecting = false;
        this.ws = null;
        // Clear stale state on disconnect to prevent showing old position on reconnect
        this.currentState = {};
        logger.tracker.debug('WebSocket disconnected');
        this.onConnectionChange?.(false);
        this.scheduleReconnect();
      });
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        if (this.shouldReconnect) {
          this.resolveDatarefsAndConnect();
        }
      }, RECONNECT_DELAY);
    }
  }

  private subscribeToDatarefs(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.resolvedDatarefs.length === 0) return;

    const message = JSON.stringify({
      req_id: 1,
      type: 'dataref_subscribe_values',
      params: {
        datarefs: this.resolvedDatarefs.map((dr) => ({ id: dr.id })),
      },
    });

    this.ws.send(message);
  }

  private handleDatarefUpdate(data: Record<string, number | number[]>): void {
    for (const [idStr, value] of Object.entries(data)) {
      const id = parseInt(idStr, 10);
      const datarefName = this.datarefIdToName.get(id);
      if (!datarefName) continue;

      // Handle metadata flags (is_helicopter, is_airliner, etc.)
      if (datarefName.startsWith('sim/aircraft2/metadata/is_') && typeof value === 'number') {
        this.metadataFlags.set(datarefName, value);
        continue;
      }

      const stateKey = DATAREF_MAPPING[datarefName];
      if (stateKey && typeof value === 'number') {
        let convertedValue = value;
        if (
          datarefName === 'sim/flightmodel/position/elevation' ||
          datarefName === 'sim/flightmodel/position/y_agl'
        ) {
          convertedValue = value * METERS_TO_FEET;
        } else if (datarefName === 'sim/flightmodel/position/groundspeed') {
          convertedValue = value * MPS_TO_KNOTS;
        }
        (this.currentState as Record<string, unknown>)[stateKey] = convertedValue;
      }
    }

    // Derive aircraft category from metadata flags
    this.currentState.aircraftCategory = this.deriveAircraftCategory();

    if (
      this.currentState.latitude !== undefined &&
      this.currentState.longitude !== undefined &&
      this.onStateUpdate
    ) {
      this.onStateUpdate(this.currentState as PlaneState);
    }
  }

  private deriveAircraftCategory(): AircraftCategory | null {
    for (const [datarefName, category] of METADATA_CATEGORY_MAP) {
      if (this.metadataFlags.get(datarefName) === 1) return category;
    }
    return null;
  }
}

let wsClientInstance: XPlaneWebSocketClient | null = null;

export function getWebSocketClient(port?: number): XPlaneWebSocketClient {
  if (!wsClientInstance || (port !== undefined && wsClientInstance.getPort() !== port)) {
    wsClientInstance?.disconnect();
    wsClientInstance = new XPlaneWebSocketClient(port);
  }
  return wsClientInstance;
}
