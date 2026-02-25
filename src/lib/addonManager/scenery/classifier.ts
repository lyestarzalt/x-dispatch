// src/lib/addonManager/scenery/classifier.ts
import { type SceneryClassification, SceneryPriority } from '../core/types';

/**
 * Classify a scenery folder based on its scan results.
 * Uses decision tree - first match wins.
 *
 * Priority order (per plan Step 5):
 * 1. Has apt.dat → Airport
 * 2. No apt.dat, but worldeditor → Airport (WorldEditor = airport scenery)
 * 3. DSF sim/overlay == "1" → Overlay
 * 4. Has library.txt, NO Earth nav data → check for SAM → FixedHighPriority or Library
 * 5. Has Earth nav data, no apt.dat, not overlay → Mesh
 * 6. DSF has terrain refs → Mesh
 * 7. Plugins only → Other
 * 8. Nothing recognized → Unrecognized
 */
export function classifyScenery(folderName: string, scan: SceneryClassification): SceneryPriority {
  // 1. Has apt.dat → Airport
  if (scan.hasAptDat) {
    return SceneryPriority.Airport;
  }

  // 2. No apt.dat, but worldeditor → Airport (WorldEditor packages are airport scenery)
  if (scan.dsfInfo.parsed && scan.dsfInfo.creationAgent.toLowerCase().includes('worldeditor')) {
    return SceneryPriority.Airport;
  }

  // 3. DSF sim/overlay → Overlay
  if (scan.dsfInfo.parsed && scan.dsfInfo.isOverlay) {
    return SceneryPriority.Overlay;
  }

  // 4. Has library.txt, NO Earth nav data → Library (or SAM)
  if (scan.hasLibraryTxt && !scan.hasEarthNavData) {
    // Check if it's SAM library (needs to be at top)
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

  // 8. Has library.txt with Earth nav data (scenery + library combo)
  if (scan.hasLibraryTxt) {
    return SceneryPriority.Library;
  }

  // 9. Nothing recognized → Unrecognized
  return SceneryPriority.Unrecognized;
}

/**
 * Check if folder name indicates SAM (Scenery Animation Manager) library.
 * SAM needs to be loaded first (FixedHighPriority).
 */
function isSamLibrary(folderName: string): boolean {
  const lower = folderName.toLowerCase();
  return (
    lower.includes('sam_') ||
    lower.includes('_sam') ||
    lower === 'sam' ||
    lower.includes('sam_library') ||
    lower.includes('sam_seasons')
  );
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
