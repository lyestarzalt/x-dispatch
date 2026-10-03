/**
 * X-Plane Service
 *
 * Handles both REST API and WebSocket streaming.
 * Runs in Electron's main process to avoid CORS issues.
 */
import type { TrafficSnapshot } from '@/types/traffic';
import type { PlaneState } from '@/types/xplane';
import type { FlightInit } from './generated/xplaneApi';
import { isXPlaneProcessRunning } from './processCheck';
import { getRestClient } from './restClient';
import { type RawDatarefSink, XPlaneWebSocketClient } from './websocketClient';

let recorderSink: RawDatarefSink | null = null;

export interface StreamSubscriber {
  onUpdate: (state: PlaneState) => void;
  onConnectionChange?: (connected: boolean) => void;
  onStateClear?: () => void;
}

export class XPlaneService {
  private wsClient: XPlaneWebSocketClient;
  private apiPort: number;

  constructor(apiPort: number = 8086) {
    this.apiPort = apiPort;
    this.wsClient = new XPlaneWebSocketClient(apiPort);
    this.wsClient.setSink(recorderSink);
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
  //
  // Several UIs (the desktop window, tablets) share one upstream socket: the
  // first subscriber opens it, the last one closes it, and every callback
  // fans out to all of them.

  private streamSubscribers = new Map<string, StreamSubscriber>();
  private trafficSubscribers = new Map<string, (snapshot: TrafficSnapshot) => void>();

  startStateStream(subscriberId: string, callbacks: StreamSubscriber): void {
    const first = this.streamSubscribers.size === 0;
    this.streamSubscribers.set(subscriberId, callbacks);
    if (first) {
      this.wsClient.connect(
        (state) => this.streamSubscribers.forEach((s) => s.onUpdate(state)),
        (connected) => this.streamSubscribers.forEach((s) => s.onConnectionChange?.(connected)),
        () => this.streamSubscribers.forEach((s) => s.onStateClear?.())
      );
    } else if (this.wsClient.isConnected()) {
      callbacks.onConnectionChange?.(true);
    }
  }

  stopStateStream(subscriberId?: string): void {
    if (subscriberId === undefined) {
      this.streamSubscribers.clear();
    } else {
      this.streamSubscribers.delete(subscriberId);
    }
    if (this.streamSubscribers.size === 0) this.wsClient.disconnect();
  }

  forceReconnect(): void {
    this.wsClient.forceReconnect();
  }

  setTrafficEnabled(
    subscriberId: string,
    enabled: boolean,
    onTraffic: ((snapshot: TrafficSnapshot) => void) | null
  ) {
    if (enabled && onTraffic) {
      this.trafficSubscribers.set(subscriberId, onTraffic);
    } else {
      this.trafficSubscribers.delete(subscriberId);
    }
    const any = this.trafficSubscribers.size > 0;
    this.wsClient.setTrafficEnabled(
      any,
      any ? (snapshot) => this.trafficSubscribers.forEach((cb) => cb(snapshot)) : null
    );
  }

  /** Remove a client (window or tablet) from every stream it joined. */
  unsubscribe(subscriberId: string): void {
    if (this.streamSubscribers.has(subscriberId)) this.stopStateStream(subscriberId);
    if (this.trafficSubscribers.has(subscriberId))
      this.setTrafficEnabled(subscriberId, false, null);
  }

  isStreamConnected(): boolean {
    return this.wsClient.isConnected();
  }

  getPort(): number {
    return this.apiPort;
  }
}

let serviceInstance: XPlaneService | null = null;

/**
 * The recorder outlives any one service instance (the port can change), so
 * the sink is kept here and handed to every client the service creates.
 */
export function setRecorderSink(sink: RawDatarefSink | null): void {
  recorderSink = sink;
  serviceInstance?.['wsClient'].setSink(sink);
}

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
