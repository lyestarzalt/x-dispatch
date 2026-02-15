import type { XPlaneAPIResult } from '@/types/xplane';

const DEFAULT_PORT = 8086;
const CONNECTION_TIMEOUT = 2000;
const MIN_FLIGHT_API_VERSION = '12.4.0';

export type FlightAPIPayload = Record<string, unknown>;

interface APICapabilities {
  api: { versions: string[] };
  'x-plane': { version: string };
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
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

  async getVersion(): Promise<string | null> {
    if (this.cachedVersion) return this.cachedVersion;

    try {
      const response = await fetch(`http://localhost:${this.port}/api/capabilities`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as APICapabilities;
      this.cachedVersion = data['x-plane']?.version || null;
      return this.cachedVersion;
    } catch {
      return null;
    }
  }

  async isFlightAPIAvailable(): Promise<boolean> {
    const version = await this.getVersion();
    if (!version) return false;
    return compareVersions(version, MIN_FLIGHT_API_VERSION) >= 0;
  }

  async loadFlight(payload: FlightAPIPayload): Promise<XPlaneAPIResult> {
    const version = await this.getVersion();
    if (!version) {
      return { success: false, error: 'Cannot connect to X-Plane API' };
    }

    if (compareVersions(version, MIN_FLIGHT_API_VERSION) < 0) {
      return {
        success: false,
        error: `Flight API requires X-Plane ${MIN_FLIGHT_API_VERSION}+. You have ${version}.`,
      };
    }

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

  async getDataref(dataref: string): Promise<number | number[] | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/datarefs?filter[name]=${encodeURIComponent(dataref)}&fields=id`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) return null;

      const listData = await response.json();
      if (!listData.data?.[0]?.id) return null;

      const id = listData.data[0].id;
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

  async setDataref(dataref: string, value: number | number[]): Promise<XPlaneAPIResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/datarefs?filter[name]=${encodeURIComponent(dataref)}&fields=id`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        return { success: false, error: 'Dataref not found' };
      }

      const listData = await response.json();
      if (!listData.data?.[0]?.id) {
        return { success: false, error: 'Dataref not found' };
      }

      const id = listData.data[0].id;
      const patchResponse = await fetch(`${this.baseUrl}/datarefs/${id}/value`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
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
