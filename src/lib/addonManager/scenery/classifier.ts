// src/lib/addonManager/scenery/classifier.ts
import { type SceneryClassification, SceneryPriority } from '../core/types';

// Prefixes that, combined with "sam", indicate a SAM-related library
const SAM_PREFIXES = ['open', 'my', 'custom', 'new'];

/**
 * Classify a scenery folder based on its scan results.
 * Uses decision tree - first match wins.
 *
 * Priority order:
 * 1. Has apt.dat → Airport
 * 2. DSF sim/overlay → Overlay (even WorldEditor-made, e.g. Landmarks)
 * 3. WorldEditor agent (non-overlay) → Airport
 * 4. Has library.txt → check SAM → FixedHighPriority or Library
 * 5. Has Earth nav data → Mesh
 * 6. DSF has terrain refs → Mesh
 * 7. Plugins only → Other
 * 8. Nothing recognized → Unrecognized
 */
export function classifyScenery(folderName: string, scan: SceneryClassification): SceneryPriority {
  // 1. Has apt.dat → Airport
  if (scan.hasAptDat) {
    return SceneryPriority.Airport;
  }

  // 2. DSF sim/overlay → Overlay (even if made with WorldEditor, e.g. Landmarks)
  if (scan.dsfInfo.parsed && scan.dsfInfo.isOverlay) {
    return SceneryPriority.Overlay;
  }

  // 3. No apt.dat, no overlay, but WorldEditor → Airport (rare WED airport without apt.dat)
  if (scan.dsfInfo.parsed && scan.dsfInfo.creationAgent.toLowerCase().includes('worldeditor')) {
    return SceneryPriority.Airport;
  }

  // 4. Has library.txt → Library (or SAM)
  if (scan.hasLibraryTxt) {
    if (isSamLibrary(folderName)) {
      return SceneryPriority.FixedHighPriority;
    }
    return SceneryPriority.Library;
  }

  // 5. Has Earth nav data (no apt.dat, not overlay) → Mesh
  if (scan.hasEarthNavData) {
    return SceneryPriority.Mesh;
  }

  // 6. DSF has terrain refs → Mesh
  if (scan.dsfInfo.parsed && scan.dsfInfo.hasTerrainRefs) {
    return SceneryPriority.Mesh;
  }

  // 7. Plugins only → Other
  if (scan.hasPlugins) {
    return SceneryPriority.Other;
  }

  // 8. Nothing recognized → Unrecognized
  return SceneryPriority.Unrecognized;
}

/**
 * Check if folder name indicates SAM (Scenery Animation Manager) library.
 * SAM needs to be loaded first (FixedHighPriority).
 *
 * Uses word-boundary algorithm:
 * - Split folder name by non-alphanumeric chars into tokens
 * - Match if any token == "sam" exactly
 * - Match if any token ends with "sam" and the prefix is in SAM_PREFIXES
 *
 * Examples: "SAM_Library" ✅, "openSAM" ✅, "mySAM_v2" ✅, "sample" ❌, "amsterdam" ❌
 */
function isSamLibrary(folderName: string): boolean {
  const tokens = folderName.toLowerCase().split(/[^a-z0-9]+/);

  for (const token of tokens) {
    if (!token) continue;

    // Exact match: token is just "sam"
    if (token === 'sam') return true;

    // Compound match: token ends with "sam" and prefix is known
    if (token.endsWith('sam') && token.length > 3) {
      const prefix = token.slice(0, -3);
      if (SAM_PREFIXES.includes(prefix)) return true;
    }
  }

  return false;
}

/**
 * DefaultAirport tier is ONLY for the special `*GLOBAL_AIRPORTS*` marker.
 * This is not a real folder - it's handled separately when parsing/writing the INI.
 * Regular folders (even Laminar ones) should be classified as Airport, not DefaultAirport.
 */

/**
 * Get display label for a priority tier.
 */
export function getPriorityLabel(priority: SceneryPriority): string {
  switch (priority) {
    case SceneryPriority.FixedHighPriority:
      return 'SAM';
    case SceneryPriority.Airport:
      return 'Airport';
    case SceneryPriority.DefaultAirport:
      return 'Default';
    case SceneryPriority.Library:
      return 'Library';
    case SceneryPriority.Other:
      return 'Other';
    case SceneryPriority.Overlay:
      return 'Overlay';
    case SceneryPriority.AirportMesh:
      return 'AirportMesh';
    case SceneryPriority.Mesh:
      return 'Mesh';
    case SceneryPriority.Unrecognized:
      return 'Unknown';
  }
}
