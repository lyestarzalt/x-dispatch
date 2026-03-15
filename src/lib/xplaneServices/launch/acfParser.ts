import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { Aircraft, Livery } from '@/types/aircraft';

function parseAcfFile(acfPath: string, xplanePath: string): Aircraft | null {
  try {
    const content = fs.readFileSync(acfPath, 'utf-8');
    const lines = content.split('\n');

    const props: Record<string, string> = {};

    for (let line of lines) {
      line = line.trimEnd(); // Handle CRLF line endings
      // Parse both `P acf/` and `P _cgpt/` properties
      if (line.startsWith('P acf/') || line.startsWith('P _cgpt/')) {
        const match = line.match(/^P ([^\s]+)\s+(.*)$/);
        if (match) {
          props[match[1]] = match[2];
        }
      }
    }

    // Get relative path from X-Plane root
    const relativePath = path.relative(xplanePath, acfPath).replace(/\\/g, '/');

    const acfDir = path.dirname(acfPath);
    const acfBasename = path.basename(acfPath, '.acf');
    const previewImage = findPreviewImage(acfDir, acfBasename);
    const thumbnailImage = findThumbnailImage(acfDir, acfBasename);

    // Find liveries
    const liveries = scanLiveries(acfDir);

    // Parse fuel tank names and ratios
    //
    // Laminar aircraft (R22, S-76, Cessna, etc.) use the standard properties:
    //   acf/_tank_name/0..8  — human-readable tank names ("Main", "Aux")
    //   acf/_tank_rat/0..8   — fraction of _m_fuel_max_tot per tank (sum ≈ 1.0)
    //
    // Third-party aircraft (XFER H145, Mirage-V, etc.) often omit _tank_name.
    // In that case we use two fallback strategies:
    //
    // Fallback A — _tank_rat as source of truth for tank count:
    //   _tank_rat tells X-Plane how many real pilot-visible tanks exist.
    //   e.g. H145 has _tank_rat/0=1.0 (one tank, 100% of fuel) even though
    //   _cgpt has two 804lb entries for internal CG distribution. X-Plane's
    //   own UI shows 1 tank at 723kg — _tank_rat is correct, _cgpt is not.
    //   We pair non-zero _tank_rat entries with _cgpt names for display.
    //
    // Fallback B — _cgpt w_max (last resort):
    //   If _tank_rat is entirely zero (unlikely but defensive), derive tank
    //   structure from _cgpt entries with non-zero _w_max.
    const tankNames: string[] = [];
    const tankRatios: number[] = [];
    const tankIndices: number[] = [];
    const maxFuelTotal = parseFloat(props['acf/_m_fuel_max_tot']) || 0;

    // Primary path: acf/_tank_name properties (works for all Laminar aircraft)
    for (let i = 0; i < 9; i++) {
      const tankName = props[`acf/_tank_name/${i}`];
      if (tankName) {
        tankNames.push(tankName);
        tankRatios.push(parseFloat(props[`acf/_tank_rat/${i}`]) || 0);
        tankIndices.push(i);
      }
    }

    // Fallback when acf/_tank_name is missing (third-party aircraft)
    if (tankNames.length === 0 && maxFuelTotal > 0) {
      // Fallback A: use non-zero _tank_rat entries — these are the real tanks
      // that X-Plane exposes to the pilot (e.g. H145: 1 tank at ratio 1.0)
      // Preserve the original X-Plane slot index so fuel is placed correctly
      // (e.g. Sea King uses slot 1, not 0).
      for (let i = 0; i < 9; i++) {
        const ratio = parseFloat(props[`acf/_tank_rat/${i}`]) || 0;
        if (ratio > 0) {
          const cgptIdx = i + 1;
          const cgptName = props[`_cgpt/${cgptIdx}/_name`] || `Tank ${i + 1}`;
          tankNames.push(cgptName);
          tankRatios.push(ratio);
          tankIndices.push(i);
        }
      }

      // Fallback B: if _tank_rat is all zeros, derive from _cgpt capacity
      if (tankNames.length === 0) {
        for (let i = 0; i < 9; i++) {
          const cgptIdx = i + 1;
          const cgptName = props[`_cgpt/${cgptIdx}/_name`];
          const maxWeight = parseFloat(props[`_cgpt/${cgptIdx}/_w_max`]) || 0;
          if (cgptName && maxWeight > 0) {
            tankNames.push(cgptName);
            tankRatios.push(maxWeight / maxFuelTotal);
            tankIndices.push(i);
          }
        }
      }
    }

    // Parse payload stations (up to 9)
    // Laminar aircraft define named stations (Pilot, Copilot, Baggage, etc.)
    // Third-party aircraft (XFER H145) often omit these entirely.
    const payloadStations: { name: string; maxWeight: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const name = props[`acf/_fixed_name/${i}`];
      const maxWeight = parseFloat(props[`acf/_fixed_max/${i}`]) || 0;
      if (name && maxWeight > 0) {
        payloadStations.push({ name, maxWeight });
      }
    }
    // Fallback: synthesize a single "Payload" station from available weight
    // budget, same as X-Plane's own UI which shows a generic payload slider
    // when no named stations exist.
    if (payloadStations.length === 0) {
      const emptyLbs = parseFloat(props['acf/_m_empty']) || 0;
      const maxLbs = parseFloat(props['acf/_m_max']) || 0;
      const availablePayload = maxLbs - emptyLbs - maxFuelTotal;
      if (availablePayload > 0) {
        payloadStations.push({ name: 'Payload', maxWeight: availablePayload });
      }
    }

    return {
      path: relativePath,
      name: props['acf/_name'] || path.basename(acfPath, '.acf'),
      icao: props['acf/_ICAO'] || '',
      description: props['acf/_descrip'] || '',
      manufacturer: props['acf/_manufacturer'] || 'Unknown',
      studio: props['acf/_studio'] || '',
      author: props['acf/_author'] || '',
      tailNumber: props['acf/_tailnum'] || '',
      // Weights (lbs)
      emptyWeight: parseFloat(props['acf/_m_empty']) || 0,
      maxWeight: parseFloat(props['acf/_m_max']) || 0,
      maxFuel: parseFloat(props['acf/_m_fuel_max_tot']) || 0,
      tankNames,
      tankRatios,
      tankIndices,
      payloadStations,
      // Aircraft type
      isHelicopter: props['acf/_is_helicopter'] === '1',
      engineCount: parseInt(props['acf/_num_engn'], 10) || 0,
      propCount: parseInt(props['acf/_num_prop'], 10) || 0,
      // Speeds (knots)
      vneKts: parseFloat(props['acf/_Vne_kts']) || 0,
      vnoKts: parseFloat(props['acf/_Vno_kts']) || 0,
      previewImage,
      thumbnailImage,
      liveries,
    };
  } catch (err) {
    logger.launcher.debug(`Failed to parse: ${acfPath}`, err);
    return null;
  }
}

/**
 * Scan the Aircraft directory for all .acf files
 */
export function scanAircraftDirectory(xplanePath: string): Aircraft[] {
  const startTime = Date.now();
  const aircraftDir = path.join(xplanePath, 'Aircraft');
  const aircraft: Aircraft[] = [];

  logger.launcher.info(`Scanning aircraft directory: ${aircraftDir}`);

  if (!fs.existsSync(aircraftDir)) {
    logger.launcher.warn(`Aircraft directory not found: ${aircraftDir}`);
    return aircraft;
  }

  // Recursively find all .acf files
  const acfFiles = findAcfFiles(aircraftDir);
  logger.launcher.info(`Found ${acfFiles.length} .acf files`);

  let parseErrors = 0;
  for (const acfFile of acfFiles) {
    const parsed = parseAcfFile(acfFile, xplanePath);
    if (parsed) {
      aircraft.push(parsed);
    } else {
      parseErrors++;
    }
  }

  // Sort by manufacturer, then by name
  aircraft.sort((a, b) => {
    const mfgCompare = a.manufacturer.localeCompare(b.manufacturer);
    if (mfgCompare !== 0) return mfgCompare;
    return a.name.localeCompare(b.name);
  });

  // Log summary stats
  const elapsed = Date.now() - startTime;
  const manufacturers = new Set(aircraft.map((a) => a.manufacturer)).size;
  const helicopters = aircraft.filter((a) => a.isHelicopter).length;
  const fixedWing = aircraft.length - helicopters;
  const withLiveries = aircraft.filter((a) => a.liveries.length > 1).length;
  const totalLiveries = aircraft.reduce((sum, a) => sum + a.liveries.length, 0);

  logger.launcher.info(
    `Aircraft scan complete in ${elapsed}ms: ${aircraft.length} aircraft (${fixedWing} fixed-wing, ${helicopters} helicopters), ${manufacturers} manufacturers, ${totalLiveries} liveries total`
  );
  if (parseErrors > 0) {
    logger.launcher.warn(`Failed to parse ${parseErrors} .acf files`);
  }
  if (withLiveries > 0) {
    logger.launcher.debug(`${withLiveries} aircraft have custom liveries`);
  }

  return aircraft;
}

/**
 * Recursively find all .acf files in a directory
 */
function findAcfFiles(dir: string): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and common non-aircraft folders
        if (!entry.name.startsWith('.') && entry.name !== 'liveries') {
          results.push(...findAcfFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.acf')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip directories that can't be read
  }

  return results;
}

function findPreviewImage(acfDir: string, acfBasename: string): string | null {
  // Try common naming patterns
  const patterns = [
    `${acfBasename}_icon11.png`,
    `${acfBasename}_icon.png`,
    'icon11.png',
    'icon.png',
  ];

  for (const pattern of patterns) {
    const imagePath = path.join(acfDir, pattern);
    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
  }

  return null;
}

function findThumbnailImage(acfDir: string, acfBasename: string): string | null {
  const patterns = [
    `${acfBasename}_icon11_thumb.png`,
    `${acfBasename}_thumb.png`,
    'icon11_thumb.png',
    'thumb.png',
  ];

  for (const pattern of patterns) {
    const imagePath = path.join(acfDir, pattern);
    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
  }

  return null;
}

function scanLiveries(acfDir: string): Livery[] {
  const liveriesDir = path.join(acfDir, 'liveries');
  const liveries: Livery[] = [];

  // Add default livery first
  liveries.push({
    name: 'Default',
    displayName: 'Default',
    previewImage: null,
  });

  if (!fs.existsSync(liveriesDir)) {
    return liveries;
  }

  try {
    const entries = fs.readdirSync(liveriesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const liveryPath = path.join(liveriesDir, entry.name);
        const previewImage = findLiveryPreview(liveryPath);

        liveries.push({
          name: entry.name,
          displayName: entry.name.replace(/_/g, ' '),
          previewImage,
        });
      }
    }
  } catch {
    // Skip liveries that can't be read
  }

  return liveries;
}

function findLiveryPreview(liveryDir: string): string | null {
  try {
    const entries = fs.readdirSync(liveryDir);

    // Look for icon11.png or similar
    for (const entry of entries) {
      if (entry.endsWith('_icon11.png') || entry === 'icon11.png') {
        return path.join(liveryDir, entry);
      }
    }

    // Fallback to any PNG
    for (const entry of entries) {
      if (entry.endsWith('.png') && !entry.includes('thumb')) {
        return path.join(liveryDir, entry);
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Generate the aircraft key used in Freeflight.prf
 */
export function generateAircraftKey(aircraftPath: string): string {
  return (
    '_' +
    aircraftPath
      .replace(/\//g, '')
      .replace(/\./g, '')
      .replace(/-/g, '')
      .replace(/ /g, '')
      .replace(/_/g, '')
  );
}
