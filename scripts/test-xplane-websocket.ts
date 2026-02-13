/**
 * X-Plane WebSocket API Test Script
 *
 * Tests the X-Plane Web API by:
 * 1. Resolving dataref names to IDs via REST API
 * 2. Connecting to WebSocket
 * 3. Subscribing to datarefs
 * 4. Logging updates to console in realtime
 *
 * Usage: npx tsx scripts/test-xplane-websocket.ts
 *
 * Requires X-Plane 12 running with Web API enabled (default port 8086)
 */
import WebSocket from 'ws';

const PORT = 8086;
const METERS_TO_FEET = 3.28084;
const MPS_TO_KNOTS = 1.94384;

// Datarefs to subscribe to
const DATAREF_NAMES = [
  'sim/flightmodel/position/latitude',
  'sim/flightmodel/position/longitude',
  'sim/flightmodel/position/elevation',
  'sim/flightmodel/position/psi',
  'sim/flightmodel/position/groundspeed',
  'sim/flightmodel/position/indicated_airspeed',
  'sim/flightmodel/position/y_agl',
  'sim/cockpit2/gauges/indicators/vvi_fpm_pilot',
];

// Human-readable labels
const LABELS: Record<string, string> = {
  'sim/flightmodel/position/latitude': 'LAT',
  'sim/flightmodel/position/longitude': 'LON',
  'sim/flightmodel/position/elevation': 'ALT (ft)',
  'sim/flightmodel/position/psi': 'HDG',
  'sim/flightmodel/position/groundspeed': 'GS (kt)',
  'sim/flightmodel/position/indicated_airspeed': 'IAS (kt)',
  'sim/flightmodel/position/y_agl': 'AGL (ft)',
  'sim/cockpit2/gauges/indicators/vvi_fpm_pilot': 'VS (fpm)',
};

interface DatarefInfo {
  id: number;
  name: string;
}

const datarefIdToName = new Map<number, string>();
const currentValues: Record<string, number> = {};

async function resolveDatarefIds(): Promise<DatarefInfo[]> {
  console.log('\n[1/3] Resolving dataref IDs via REST API...\n');

  const filterParams = DATAREF_NAMES.map((name) => `filter[name]=${encodeURIComponent(name)}`).join(
    '&'
  );

  const url = `http://localhost:${PORT}/api/v3/datarefs?${filterParams}&fields=id,name`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const results: DatarefInfo[] = [];

    if (data.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.id && item.name) {
          results.push({ id: item.id, name: item.name });
          console.log(`  ${item.name} -> ID ${item.id}`);
        }
      }
    }

    console.log(`\n  Resolved ${results.length}/${DATAREF_NAMES.length} datarefs`);
    return results;
  } catch (err) {
    throw new Error(`Failed to resolve datarefs: ${err}`);
  }
}

function connectWebSocket(datarefs: DatarefInfo[]): void {
  console.log('\n[2/3] Connecting to WebSocket...\n');

  const ws = new WebSocket(`ws://localhost:${PORT}/api/v3`);

  ws.on('open', () => {
    console.log('  WebSocket connected!\n');
    console.log('[3/3] Subscribing to datarefs...\n');

    // Build ID to name mapping
    for (const dr of datarefs) {
      datarefIdToName.set(dr.id, dr.name);
    }

    // Subscribe
    const message = JSON.stringify({
      req_id: 1,
      type: 'dataref_subscribe_values',
      params: {
        datarefs: datarefs.map((dr) => ({ id: dr.id })),
      },
    });

    ws.send(message);
    console.log('  Subscribed! Waiting for data...\n');
    console.log('  Press Ctrl+C to exit\n');
    console.log('─'.repeat(60));
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'dataref_update_values') {
        handleDatarefUpdate(msg.data);
      } else if (msg.type === 'result') {
        if (msg.success) {
          console.log('  Subscription confirmed\n');
        } else {
          console.error('  Subscription failed:', msg.error);
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.log('\nWebSocket disconnected');
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\nClosing connection...');
    ws.close();
  });
}

function handleDatarefUpdate(data: Record<string, number | number[]>): void {
  let updated = false;

  for (const [idStr, value] of Object.entries(data)) {
    const id = parseInt(idStr, 10);
    const name = datarefIdToName.get(id);
    if (!name || typeof value !== 'number') continue;

    // Convert units
    let convertedValue = value;
    if (
      name === 'sim/flightmodel/position/elevation' ||
      name === 'sim/flightmodel/position/y_agl'
    ) {
      convertedValue = value * METERS_TO_FEET;
    } else if (name === 'sim/flightmodel/position/groundspeed') {
      convertedValue = value * MPS_TO_KNOTS;
    }

    currentValues[name] = convertedValue;
    updated = true;
  }

  if (updated) {
    printCurrentState();
  }
}

function printCurrentState(): void {
  // Clear line and move cursor up
  process.stdout.write('\x1B[2K\x1B[1A'.repeat(DATAREF_NAMES.length + 1));

  console.log('─'.repeat(60));
  for (const name of DATAREF_NAMES) {
    const label = LABELS[name] || name;
    const value = currentValues[name];
    if (value !== undefined) {
      const formatted = formatValue(name, value);
      console.log(`  ${label.padEnd(12)} ${formatted}`);
    } else {
      console.log(`  ${label.padEnd(12)} --`);
    }
  }
}

function formatValue(name: string, value: number): string {
  if (name.includes('latitude') || name.includes('longitude')) {
    return value.toFixed(6);
  }
  if (name.includes('psi')) {
    return `${value.toFixed(1)}°`;
  }
  if (name.includes('elevation') || name.includes('y_agl')) {
    return Math.round(value).toLocaleString();
  }
  if (name.includes('vvi')) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Math.round(value).toLocaleString()}`;
  }
  return Math.round(value).toString();
}

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('  X-Plane WebSocket API Test');
  console.log('═'.repeat(60));
  console.log(`\n  Target: localhost:${PORT}`);

  try {
    const datarefs = await resolveDatarefIds();

    if (datarefs.length === 0) {
      console.error('\nNo datarefs resolved. Is X-Plane running?');
      process.exit(1);
    }

    connectWebSocket(datarefs);
  } catch (err) {
    console.error(`\nError: ${err}`);
    console.error('\nMake sure X-Plane 12 is running with Web API enabled.');
    process.exit(1);
  }
}

main();
