#!/usr/bin/env node
// Build the compact city list behind the night-side city lights on the globe.
//
// Source: Natural Earth 1:10m populated places (public domain), simple
// attribute variant. Output: one `[lon, lat, tier]` triple per place with a
// population of at least MIN_POPULATION or a national capital, coordinates
// rounded to 0.01 degrees. Tier drives the glow radius.
//
// Usage:
//   node scripts/build-populated-places.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
const OUTPUT = fileURLToPath(new URL('../src/lib/map/solar/populatedPlaces.json', import.meta.url));

const MIN_POPULATION = 50_000;
const TIER_THRESHOLDS = [5_000_000, 1_000_000, 250_000];

function tierFor(population) {
  const index = TIER_THRESHOLDS.findIndex((threshold) => population >= threshold);
  return index === -1 ? 0 : TIER_THRESHOLDS.length - index;
}

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Download failed: ${response.status} ${response.statusText}`);
}
const geojson = await response.json();

const places = [];
for (const feature of geojson.features) {
  const { pop_max: population, adm0cap: isCapital } = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  if (!(population >= MIN_POPULATION) && isCapital !== 1) continue;
  places.push([
    Math.round(lon * 100) / 100,
    Math.round(lat * 100) / 100,
    tierFor(Math.max(0, population)),
  ]);
}

places.sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]);

await writeFile(OUTPUT, `${JSON.stringify(places)}\n`);
console.log(`Wrote ${places.length} places to ${OUTPUT}`);
