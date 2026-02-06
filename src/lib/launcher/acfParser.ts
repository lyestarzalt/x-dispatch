import * as fs from 'fs';
import * as path from 'path';
import logger from '../logger';
import type { Aircraft, Livery } from './types';

function parseAcfFile(acfPath: string, xplanePath: string): Aircraft | null {
  try {
    const content = fs.readFileSync(acfPath, 'utf-8');
    const lines = content.split('\n');

    const props: Record<string, string> = {};

    for (const line of lines) {
      if (line.startsWith('P acf/')) {
        const match = line.match(/^P (acf\/[^\s]+)\s+(.*)$/);
        if (match) {
          props[match[1]] = match[2].trim();
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

    // Parse fuel tank names
    const tankNames: string[] = [];
    for (let i = 0; i < 9; i++) {
      const tankName = props[`acf/_tank_name/${i}`];
      if (tankName) {
        tankNames.push(tankName);
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
  } catch {
    return null;
  }
}

/**
 * Scan the Aircraft directory for all .acf files
 */
export function scanAircraftDirectory(xplanePath: string): Aircraft[] {
  const aircraftDir = path.join(xplanePath, 'Aircraft');
  const aircraft: Aircraft[] = [];

  if (!fs.existsSync(aircraftDir)) {
    return aircraft;
  }

  // Recursively find all .acf files
  const acfFiles = findAcfFiles(aircraftDir);

  for (const acfFile of acfFiles) {
    const parsed = parseAcfFile(acfFile, xplanePath);
    if (parsed) {
      aircraft.push(parsed);
    }
  }

  // Sort by manufacturer, then by name
  aircraft.sort((a, b) => {
    const mfgCompare = a.manufacturer.localeCompare(b.manufacturer);
    if (mfgCompare !== 0) return mfgCompare;
    return a.name.localeCompare(b.name);
  });

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
    '_' + aircraftPath.replace(/\//g, '').replace(/\./g, '').replace(/-/g, '').replace(/ /g, '')
  );
}
