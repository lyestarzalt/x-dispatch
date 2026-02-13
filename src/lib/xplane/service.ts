import type { PlaneState, XPlaneAPIResult } from '@/types/xplane';
import { isXPlaneProcessRunning } from './processCheck';
import type { FlightAPIPayload } from './restClient';
import { XPlaneRestClient } from './restClient';
import { XPlaneWebSocketClient } from './websocketClient';

export class XPlaneService {
  private restClient: XPlaneRestClient;
  private wsClient: XPlaneWebSocketClient;
  private apiPort: number;

  constructor(apiPort: number = 8086) {
    this.apiPort = apiPort;
    this.restClient = new XPlaneRestClient(apiPort);
    this.wsClient = new XPlaneWebSocketClient(apiPort);
  }

  async isAPIAvailable(): Promise<boolean> {
    return this.restClient.isRunning();
  }

  async isProcessRunning(): Promise<boolean> {
    return isXPlaneProcessRunning();
  }

  async isSimRunning(): Promise<boolean> {
    const processRunning = await isXPlaneProcessRunning();
    if (processRunning) return true;
    return this.restClient.isRunning();
  }

  async loadFlightViaAPI(payload: FlightAPIPayload): Promise<XPlaneAPIResult> {
    const isRunning = await this.isSimRunning();
    if (!isRunning) {
      return { success: false, error: 'X-Plane is not running' };
    }
    return this.restClient.loadFlight(payload);
  }

  async getDataref(dataref: string): Promise<number | number[] | null> {
    return this.restClient.getDataref(dataref);
  }

  async setDataref(dataref: string, value: number | number[]): Promise<XPlaneAPIResult> {
    return this.restClient.setDataref(dataref, value);
  }

  startStateStream(
    onUpdate: (state: PlaneState) => void,
    onConnectionChange?: (connected: boolean) => void
  ): void {
    this.wsClient.connect(onUpdate, onConnectionChange);
  }

  stopStateStream(): void {
    this.wsClient.disconnect();
  }

  isStreamConnected(): boolean {
    return this.wsClient.isConnected();
  }

  getPort(): number {
    return this.apiPort;
  }
}

let serviceInstance: XPlaneService | null = null;

export function getXPlaneService(port?: number): XPlaneService {
  if (!serviceInstance || (port !== undefined && serviceInstance.getPort() !== port)) {
    serviceInstance?.stopStateStream();
    serviceInstance = new XPlaneService(port);
  }
  return serviceInstance;
}

export function resetXPlaneService(): void {
  serviceInstance?.stopStateStream();
  serviceInstance = null;
}
