/**
 * X-Plane Service
 *
 * Handles both REST API and WebSocket streaming.
 * Runs in Electron's main process to avoid CORS issues.
 */
import type { PlaneState } from '@/types/xplane';
import type { FlightInit } from './generated/xplaneApi';
import { isXPlaneProcessRunning } from './processCheck';
import { getRestClient } from './restClient';
import { XPlaneWebSocketClient } from './websocketClient';

export class XPlaneService {
  private wsClient: XPlaneWebSocketClient;
  private apiPort: number;

  constructor(apiPort: number = 8086) {
    this.apiPort = apiPort;
    this.wsClient = new XPlaneWebSocketClient(apiPort);
  }

  // === REST API Methods ===

  async isAPIAvailable(): Promise<boolean> {
    return getRestClient(this.apiPort).isRunning();
  }

  async isProcessRunning(): Promise<boolean> {
    return isXPlaneProcessRunning();
  }

  async getCapabilities() {
    return getRestClient(this.apiPort).getCapabilities();
  }

  async startFlight(payload: FlightInit) {
    return getRestClient(this.apiPort).startFlight(payload);
  }

  async getDataref(datarefName: string) {
    return getRestClient(this.apiPort).getDataref(datarefName);
  }

  async setDataref(datarefName: string, value: number | number[]) {
    return getRestClient(this.apiPort).setDataref(datarefName, value);
  }

  async activateCommand(commandName: string, duration: number = 0) {
    return getRestClient(this.apiPort).activateCommand(commandName, duration);
  }

  // === WebSocket Methods ===

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
