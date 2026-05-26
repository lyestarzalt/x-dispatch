import * as fs from 'fs';

export interface OaciAirspaceFeature {
  id: string;
  name: string;
  airspaceClass: string;
  lowerLimit: string;
  upperLimit: string;
  coordinates: [number, number][];
}

/**
 * Lightweight SIA/AIXM XML airspace extractor (phase 2) — no DOM dependency.
 */
export function parseOaciAirspacesFromXml(xmlPath: string): OaciAirspaceFeature[] {
  if (!fs.existsSync(xmlPath)) return [];
  const text = fs.readFileSync(xmlPath, 'utf-8');
  const features: OaciAirspaceFeature[] = [];

  const blocks = text.split(/<(?:[^:>]+:)?Airspace\b/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]!.slice(0, 8000);
    const name =
      matchAttr(block, 'designator') ??
      matchTag(block, 'name') ??
      `AS-${features.length}`;
    const coords = extractLatLonPairs(block);
    if (coords.length < 3) continue;
    features.push({
      id: name,
      name,
      airspaceClass: matchTag(block, 'type') ?? matchTag(block, 'class') ?? 'D',
      lowerLimit: matchTag(block, 'lower') ?? 'GND',
      upperLimit: matchTag(block, 'upper') ?? 'FL115',
      coordinates: coords,
    });
  }

  return features;
}

function matchAttr(block: string, name: string): string | null {
  const m = block.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m?.[1]?.trim() ?? null;
}

function matchTag(block: string, localName: string): string | null {
  const m = block.match(new RegExp(`<(?:[^:>]+:)?${localName}[^>]*>([^<]+)<`, 'i'));
  return m?.[1]?.trim() ?? null;
}

function extractLatLonPairs(text: string): [number, number][] {
  const coords: [number, number][] = [];
  const posMatches = text.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g);
  for (const m of posMatches) {
    const a = parseFloat(m[1]!);
    const b = parseFloat(m[2]!);
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      coords.push([b, a]);
    } else if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
      coords.push([a, b]);
    }
  }
  return coords;
}

export function loadOaciAirspacesFromIndex(indexPath: string): OaciAirspaceFeature[] {
  if (!fs.existsSync(indexPath)) return [];
  const paths = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as string[];
  const all: OaciAirspaceFeature[] = [];
  for (const p of paths.slice(0, 20)) {
    all.push(...parseOaciAirspacesFromXml(p));
  }
  return all;
}
