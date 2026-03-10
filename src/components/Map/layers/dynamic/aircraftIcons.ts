import maplibregl from 'maplibre-gl';

const ICON_SIZE = 48;
const ICON_PREFIX = 'ac-';
const FALLBACK_ID = `${ICON_PREFIX}fallback`;

// Family fallback: maps 3-char prefix → preferred available SVG code.
// Used when the exact ICAO code SVG doesn't exist (e.g. B736 → try B738).
const FAMILY_FALLBACK: Record<string, string> = {
  B73: 'B738', // 737 family → 737-800
  B74: 'B744', // 747 family → 747-400
  B75: 'B752', // 757 family → 757-200
  B76: 'B763', // 767 family → 767-300
  B77: 'B77W', // 777 family → 777-300ER
  B78: 'B789', // 787 family → 787-9
  A31: 'A320', // A318/A319 → A320
  A32: 'A320', // A320 family
  A33: 'A333', // A330 family → A330-300
  A34: 'A343', // A340 family → A340-300
  A35: 'A359', // A350 family → A350-900
  A38: 'A388', // A380 family
  E17: 'E170', // Embraer E-Jet
  E19: 'E195', // Embraer E195
  CRJ: 'CRJ9', // CRJ family → CRJ-900
  DH8: 'DH8D', // Dash 8 family → Q400
  BCS: 'BCS3', // A220 family → A220-300
  B3X: 'B38M', // 737 MAX 10 → MAX 8
  AT7: 'AT75', // ATR 72 variant
  AT4: 'AT45', // ATR 42 variant
};

// Track loaded ICAO codes per map instance
const loaded = new WeakMap<maplibregl.Map, Set<string>>();

function getLoaded(map: maplibregl.Map): Set<string> {
  let set = loaded.get(map);
  if (!set) {
    set = new Set();
    loaded.set(map, set);
  }
  return set;
}

/**
 * Normalize ICAO type code from flight plan data.
 * Strips wake category prefixes (H/B744) and equipment suffixes (B738/M).
 */
export function normalizeIcao(raw: string): string {
  return raw
    .replace(/^[A-Z]\//, '')
    .replace(/\/.*$/, '')
    .trim()
    .toUpperCase();
}

interface IconImageData {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Convert an SVG string to a filled silhouette as ImageData for MapLibre.
 * @param color Fill/stroke color for the silhouette (default: white for SDF icons)
 */
function svgToImageData(
  svgText: string,
  size = ICON_SIZE,
  color = 'white'
): Promise<IconImageData | null> {
  return new Promise((resolve) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');

    if (doc.querySelector('parsererror')) {
      resolve(null);
      return;
    }

    // Strip Inkscape metadata that can interfere with rendering
    doc.querySelectorAll('metadata, sodipodi\\:namedview, namedview').forEach((el) => el.remove());

    // Remove hidden layers (e.g. text labels with display:none)
    doc.querySelectorAll('g').forEach((g) => {
      if (g.getAttribute('style')?.includes('display:none')) g.remove();
    });

    // Set all shape elements to colored fill silhouette.
    // Must remove inline `style` first — CSS style overrides SVG presentation attributes.
    const shapes = doc.querySelectorAll(
      'path, polygon, polyline, circle, ellipse, rect, line, text, tspan'
    );
    shapes.forEach((el) => {
      el.removeAttribute('style');
      el.setAttribute('fill', color);
      el.setAttribute('stroke', color);
      el.setAttribute('stroke-width', '0.5');
    });

    // Also clear style on <g> elements (e.g. display:inline) so it doesn't interfere
    doc.querySelectorAll('g').forEach((g) => g.removeAttribute('style'));

    const svgEl = doc.documentElement;
    svgEl.setAttribute('width', String(size));
    svgEl.setAttribute('height', String(size));

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image(size, size);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const imageData = ctx.getImageData(0, 0, size, size);
      resolve({ width: size, height: size, data: new Uint8Array(imageData.data.buffer) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Fetch and render an SVG file, returning image data or null.
 */
export async function fetchSvgIcon(
  filename: string,
  size = ICON_SIZE,
  color = 'white'
): Promise<IconImageData | null> {
  try {
    const resp = await fetch(`./aircraft-shapes/${filename}.svg`);
    if (!resp.ok) return null;
    return await svgToImageData(await resp.text(), size, color);
  } catch {
    return null;
  }
}

/**
 * Load a single aircraft icon by ICAO code.
 * Tries exact match first, then family fallback (e.g. B736 → B738).
 */
async function loadIcon(map: maplibregl.Map, icaoCode: string): Promise<boolean> {
  const imageId = `${ICON_PREFIX}${icaoCode}`;
  if (map.hasImage(imageId)) return true;

  // Try exact ICAO code
  let iconData = await fetchSvgIcon(icaoCode);

  // Try family fallback if exact code not found
  if (!iconData && icaoCode.length >= 3) {
    const familyCode = FAMILY_FALLBACK[icaoCode.slice(0, 3)];
    if (familyCode && familyCode !== icaoCode) {
      iconData = await fetchSvgIcon(familyCode);
    }
  }

  if (!iconData) return false;

  if (!map.hasImage(imageId)) {
    map.addImage(imageId, iconData, { sdf: true });
  }
  return true;
}

/**
 * Ensure the generic fallback icon is loaded on the map.
 * Uses Unidentified.svg from the aircraft shapes repo.
 */
export async function ensureFallbackIcon(map: maplibregl.Map): Promise<void> {
  if (map.hasImage(FALLBACK_ID)) return;

  const iconData = await fetchSvgIcon('Unidentified');
  if (iconData && !map.hasImage(FALLBACK_ID)) {
    map.addImage(FALLBACK_ID, iconData, { sdf: true });
  }
}

/**
 * Batch-load aircraft icons for a set of ICAO codes.
 * Deduplicates and skips already-loaded codes.
 */
export async function ensureAircraftIcons(map: maplibregl.Map, icaoCodes: string[]): Promise<void> {
  const loadedSet = getLoaded(map);
  const toLoad = [...new Set(icaoCodes)].filter((code) => code && !loadedSet.has(code));

  if (toLoad.length === 0) return;

  await Promise.all(
    toLoad.map(async (code) => {
      const ok = await loadIcon(map, code);
      if (ok) loadedSet.add(code);
    })
  );
}
