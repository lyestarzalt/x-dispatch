/**
 * X-Plane REST API Client (Main Process)
 *
 * This runs in Electron's main process to avoid CORS issues.
 * The renderer calls these via IPC through preload.
 *
 * Types are from the generated OpenAPI client at ./generated/xplaneApi.ts
 */
import type { FlightInit } from './generated/xplaneApi';

const DEFAULT_PORT = 8086;
const CONNECTION_TIMEOUT = 2000;

interface ApiCapabilities {
  api: { versions: string[] };
  'x-plane': { version: string };
}

export class XPlaneRestClient {
  private port: number;
  private cachedVersion: string | null = null;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
  }

  private get baseUrl(): string {
    return `http://localhost:${this.port}/api/v3`;
  }

  async isRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

      const response = await fetch(`${this.baseUrl}/datarefs?limit=1`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getCapabilities(): Promise<ApiCapabilities | null> {
    try {
      const response = await fetch(`http://localhost:${this.port}/api/capabilities`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return null;
      return (await response.json()) as ApiCapabilities;
    } catch {
      return null;
    }
  }

  async startFlight(payload: FlightInit): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/flight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async getDataref(datarefName: string): Promise<number | number[] | null> {
    try {
      // Find dataref ID by name
      const listResponse = await fetch(
        `${this.baseUrl}/datarefs?filter[name]=${encodeURIComponent(datarefName)}&fields=id`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );

      if (!listResponse.ok) return null;

      const listData = await listResponse.json();
      const id = listData.data?.[0]?.id;
      if (!id) return null;

      // Get value
      const valueResponse = await fetch(`${this.baseUrl}/datarefs/${id}/value`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!valueResponse.ok) return null;
      const valueData = await valueResponse.json();
      return valueData.data;
    } catch {
      return null;
    }
  }

  async setDataref(
    datarefName: string,
    value: number | number[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find dataref ID by name
      const listResponse = await fetch(
        `${this.baseUrl}/datarefs?filter[name]=${encodeURIComponent(datarefName)}&fields=id`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );

      if (!listResponse.ok) return { success: false, error: 'Dataref not found' };

      const listData = await listResponse.json();
      const id = listData.data?.[0]?.id;
      if (!id) return { success: false, error: 'Dataref not found' };

      // Set value
      const patchResponse = await fetch(`${this.baseUrl}/datarefs/${id}/value`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ data: value }),
      });

      if (!patchResponse.ok) {
        const error = await patchResponse.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async activateCommand(
    commandName: string,
    duration: number = 0
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find command ID by name
      const listResponse = await fetch(
        `${this.baseUrl}/commands?filter[name]=${encodeURIComponent(commandName)}&fields=id`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );

      if (!listResponse.ok) return { success: false, error: 'Command not found' };

      const listData = await listResponse.json();
      const id = listData.data?.[0]?.id;
      if (!id) return { success: false, error: 'Command not found' };

      // Activate
      const activateResponse = await fetch(`${this.baseUrl}/command/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ duration }),
      });

      if (!activateResponse.ok) {
        const error = await activateResponse.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  getPort(): number {
    return this.port;
  }

  clearCache(): void {
    this.cachedVersion = null;
  }
}

let restClientInstance: XPlaneRestClient | null = null;

export function getRestClient(port?: number): XPlaneRestClient {
  if (!restClientInstance || (port !== undefined && restClientInstance.getPort() !== port)) {
    restClientInstance = new XPlaneRestClient(port);
  }
  return restClientInstance;
}
