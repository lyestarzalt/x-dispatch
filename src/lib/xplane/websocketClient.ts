import WebSocket from 'ws';
import type { PlaneState } from '@/types/xplane';

const DEFAULT_PORT = 8086;
const RECONNECT_DELAY = 3000;

const DATAREFS = [
  'sim/flightmodel/position/latitude',
  'sim/flightmodel/position/longitude',
  'sim/flightmodel/position/elevation',
  'sim/flightmodel/position/y_agl',
  'sim/flightmodel/position/psi',
  'sim/flightmodel/position/theta',
  'sim/flightmodel/position/phi',
  'sim/flightmodel/position/groundspeed',
  'sim/flightmodel/position/indicated_airspeed',
  'sim/flightmodel/position/true_airspeed',
  'sim/flightmodel/position/local_vy',
  'sim/flightmodel/misc/machno',
  'sim/flightmodel/engine/ENGN_thro',
  'sim/flightmodel/controls/flaprat',
  'sim/cockpit/switches/gear_handle_status',
  'sim/flightmodel/controls/parkbrakel',
  'sim/flightmodel/controls/sbrkrat',
  'sim/flightmodel2/misc/gforce_normal',
  'sim/flightmodel2/misc/gforce_axial',
  'sim/flightmodel2/misc/gforce_side',
  'sim/cockpit/autopilot/altitude',
  'sim/cockpit/autopilot/heading_mag',
  'sim/cockpit/autopilot/airspeed',
  'sim/cockpit/autopilot/vertical_velocity',
];

const DATAREF_MAPPING: Record<string, keyof PlaneState> = {
  'sim/flightmodel/position/latitude': 'latitude',
  'sim/flightmodel/position/longitude': 'longitude',
  'sim/flightmodel/position/elevation': 'altitudeMSL',
  'sim/flightmodel/position/y_agl': 'altitudeAGL',
  'sim/flightmodel/position/psi': 'heading',
  'sim/flightmodel/position/theta': 'pitch',
  'sim/flightmodel/position/phi': 'roll',
  'sim/flightmodel/position/groundspeed': 'groundspeed',
  'sim/flightmodel/position/indicated_airspeed': 'indicatedAirspeed',
  'sim/flightmodel/position/true_airspeed': 'trueAirspeed',
  'sim/flightmodel/position/local_vy': 'verticalSpeed',
  'sim/flightmodel/misc/machno': 'mach',
  'sim/flightmodel/controls/flaprat': 'flaps',
  'sim/flightmodel/controls/parkbrakel': 'parkingBrake',
  'sim/flightmodel/controls/sbrkrat': 'speedBrake',
  'sim/flightmodel2/misc/gforce_normal': 'gForceNormal',
  'sim/flightmodel2/misc/gforce_axial': 'gForceAxial',
  'sim/flightmodel2/misc/gforce_side': 'gForceSide',
  'sim/cockpit/autopilot/altitude': 'apAltitude',
  'sim/cockpit/autopilot/heading_mag': 'apHeading',
  'sim/cockpit/autopilot/airspeed': 'apAirspeed',
  'sim/cockpit/autopilot/vertical_velocity': 'apVerticalSpeed',
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

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  connect(onStateUpdate: StateUpdateCallback, onConnectionChange?: ConnectionCallback): void {
    this.onStateUpdate = onStateUpdate;
    this.onConnectionChange = onConnectionChange ?? null;
    this.shouldReconnect = true;
    this.createConnection();
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
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getPort(): number {
    return this.port;
  }

  private createConnection(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}/api/v3`);

      this.ws.on('open', () => {
        this.isConnecting = false;
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
          // Ignore parse errors
        }
      });

      this.ws.on('error', () => {
        this.isConnecting = false;
      });

      this.ws.on('close', () => {
        this.isConnecting = false;
        this.ws = null;
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
          this.createConnection();
        }
      }, RECONNECT_DELAY);
    }
  }

  private subscribeToDatarefs(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = JSON.stringify({
      req_id: 1,
      type: 'dataref_subscribe_values',
      params: {
        datarefs: DATAREFS.map((id) => ({ id })),
      },
    });

    this.ws.send(message);
  }

  private handleDatarefUpdate(data: Record<string, number | number[]>): void {
    for (const [dataref, value] of Object.entries(data)) {
      const stateKey = DATAREF_MAPPING[dataref];
      if (stateKey) {
        (this.currentState as Record<string, unknown>)[stateKey] = value;
      }

      if (dataref === 'sim/flightmodel/engine/ENGN_thro') {
        this.currentState.throttle = Array.isArray(value) ? value[0] : value;
      }
      if (dataref === 'sim/cockpit/switches/gear_handle_status') {
        this.currentState.gearDown = value === 1;
      }
    }

    if (
      this.currentState.latitude !== undefined &&
      this.currentState.longitude !== undefined &&
      this.onStateUpdate
    ) {
      this.onStateUpdate(this.currentState as PlaneState);
    }
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
