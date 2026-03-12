import WebSocket from 'ws';
import logger from '@/lib/utils/logger';
import type { AircraftCategory, PlaneState } from '@/types/xplane';

const DEFAULT_PORT = 8086;
const RESOLVE_TIMEOUT = 5000;

// Backoff constants
const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// Keepalive constants
const PING_INTERVAL_MS = 10_000;
const PONG_TIMEOUT_MS = 5_000;

// Grace period before clearing state after disconnect
const GRACE_PERIOD_MS = 5_000;

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

type WsState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';
type StateUpdateCallback = (state: PlaneState) => void;
type ConnectionCallback = (connected: boolean) => void;
type StateClearCallback = () => void;

export class XPlaneWebSocketClient {
  private ws: WebSocket | null = null;
  private port: number;
  private onStateUpdate: StateUpdateCallback | null = null;
  private onConnectionChange: ConnectionCallback | null = null;
  private onStateClear: StateClearCallback | null = null;
  private currentState: Partial<PlaneState> = {};
  private datarefIdToName: Map<number, string> = new Map();
  private resolvedDatarefs: DatarefInfo[] = [];
  private metadataFlags: Map<string, number> = new Map();

  // State machine
  private state: WsState = 'IDLE';
  private backoffMs = BACKOFF_INITIAL_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private graceTimer: NodeJS.Timeout | null = null;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  connect(
    onStateUpdate: StateUpdateCallback,
    onConnectionChange?: ConnectionCallback,
    onStateClear?: StateClearCallback
  ): void {
    this.onStateUpdate = onStateUpdate;
    this.onConnectionChange = onConnectionChange ?? null;
    this.onStateClear = onStateClear ?? null;
    this.state = 'CONNECTING';
    this.backoffMs = BACKOFF_INITIAL_MS;
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
        if (this.state === 'CONNECTING') {
          this.state = 'RECONNECTING';
        }
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
    this.state = 'IDLE';
    this.clearAllTimers();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    // Intentional disconnect — clear state immediately, no grace period
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
   * Force reconnect — resets backoff and reconnects immediately.
   * Keeps dataref cache to avoid re-resolving.
   */
  forceReconnect(): void {
    logger.tracker.info('Force reconnect requested');
    this.clearAllTimers();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    this.backoffMs = BACKOFF_INITIAL_MS;

    if (this.onStateUpdate) {
      this.state = 'CONNECTING';
      this.resolveDatarefsAndConnect();
    }
  }

  private createConnection(): void {
    if (this.state !== 'CONNECTING') return;

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}/api/v3`);

      this.ws.on('open', () => {
        this.state = 'CONNECTED';
        this.backoffMs = BACKOFF_INITIAL_MS;
        logger.tracker.info('WebSocket connected');

        // Clear grace timer — connection re-established before state was cleared
        if (this.graceTimer) {
          clearTimeout(this.graceTimer);
          this.graceTimer = null;
        }

        this.onConnectionChange?.(true);
        this.startPingInterval();
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

      this.ws.on('pong', () => {
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
      });

      this.ws.on('error', () => {
        // close event follows — no action needed here
      });

      this.ws.on('close', () => {
        this.ws = null;
        this.stopPingInterval();

        if (this.state === 'IDLE') return; // intentional disconnect, already handled

        this.state = 'RECONNECTING';
        logger.tracker.debug(`WebSocket disconnected, reconnecting in ${this.backoffMs}ms`);
        this.startGraceTimer();
        this.scheduleReconnect();
      });
    } catch {
      this.state = 'RECONNECTING';
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.state !== 'RECONNECTING') return;
    if (this.reconnectTimer) return; // already scheduled

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.state !== 'RECONNECTING') return;
      this.state = 'CONNECTING';
      this.resolveDatarefsAndConnect();
    }, this.backoffMs);

    // Increase backoff for next attempt
    this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, BACKOFF_MAX_MS);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      this.ws.ping();

      // Start pong timeout — if no pong within 5s, connection is dead
      this.pongTimeout = setTimeout(() => {
        logger.tracker.debug('Pong timeout — terminating dead connection');
        this.ws?.terminate();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private startGraceTimer(): void {
    // Don't start a new grace timer if one is already running
    if (this.graceTimer) return;

    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.currentState = {};
      this.metadataFlags.clear();
      this.onConnectionChange?.(false);
      this.onStateClear?.();
    }, GRACE_PERIOD_MS);
  }

  private clearAllTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingInterval();
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
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
