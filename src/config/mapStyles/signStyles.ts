import { SignSize } from '@/lib/aptParser/types';

/**
 * X-Plane Sign Types per apt.dat 1100 specification
 *
 * @Y = Direction/Destination sign (black text on YELLOW background)
 * @L = Location sign (YELLOW text on black background)
 * @R = Mandatory Instruction sign (white text on RED background)
 * @B = Distance Remaining sign (white text on black background)
 */
export type SignType = 'direction' | 'location' | 'mandatory' | 'distance' | 'unknown';

export interface SignStyle {
  fontSize: number;
  minZoom: number;
  textColor: string;
  backgroundColor: string;
  haloColor: string;
  haloWidth: number;
}

export interface ParsedSign {
  text: string;
  signType: SignType;
  hasArrow: boolean;
  arrowDirection?: string;
}

/**
 * Sign size to style mapping for all 5 X-Plane sign sizes
 */
export const SIGN_STYLES: Record<number, SignStyle> = {
  [SignSize.SMALL]: {
    fontSize: 10,
    minZoom: 17,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    haloColor: '#000000',
    haloWidth: 1,
  },
  [SignSize.MEDIUM]: {
    fontSize: 12,
    minZoom: 16,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    haloColor: '#000000',
    haloWidth: 1.5,
  },
  [SignSize.LARGE]: {
    fontSize: 14,
    minZoom: 15,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    haloColor: '#000000',
    haloWidth: 2,
  },
  [SignSize.LARGE_DISTANCE_REMAINING]: {
    fontSize: 14,
    minZoom: 15,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    haloColor: '#000000',
    haloWidth: 2,
  },
  [SignSize.SMALL_DISTANCE_REMAINING]: {
    fontSize: 10,
    minZoom: 17,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    haloColor: '#000000',
    haloWidth: 1,
  },
};

const DEFAULT_SIGN_STYLE: SignStyle = {
  fontSize: 12,
  minZoom: 16,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  haloColor: '#000000',
  haloWidth: 1,
};

/**
 * Sign type colors per FAA/X-Plane spec
 */
export const SIGN_TYPE_COLORS = {
  // @Y - Direction signs: BLACK text on YELLOW background
  direction: {
    textColor: '#000000',
    haloColor: '#FFD700', // Yellow
  },
  // @L - Location signs: YELLOW text on BLACK background
  location: {
    textColor: '#FFD700', // Yellow
    haloColor: '#000000',
  },
  // @R - Mandatory/Hold signs: WHITE text on RED background
  mandatory: {
    textColor: '#FFFFFF',
    haloColor: '#CC0000', // Red
  },
  // @B - Distance remaining: WHITE text on BLACK background
  distance: {
    textColor: '#FFFFFF',
    haloColor: '#1a1a1a',
  },
  // Unknown/default
  unknown: {
    textColor: '#FFFFFF',
    haloColor: '#333333',
  },
};

/**
 * Parse X-Plane sign text to extract sign type and clean text
 *
 * Examples:
 * - "{@Y}A{^r}" -> Direction sign "A" with right arrow
 * - "{@L}T" -> Location sign "T"
 * - "{@R}15-33" -> Runway hold sign "15-33"
 * - "{@B}3" -> Distance remaining "3"
 * - "{@L}A{@Y,^l}E{^r}" -> Complex: Location "A" + Direction "E" with arrows
 */
export function parseSignText(rawText: string): ParsedSign {
  // Determine primary sign type
  let signType: SignType = 'unknown';

  // Check for sign type markers (priority: @R > @Y > @L > @B)
  if (rawText.includes('{@R}') || rawText.includes('@R')) {
    signType = 'mandatory'; // Red mandatory/hold signs
  } else if (rawText.includes('{@Y}') || rawText.includes('@Y')) {
    signType = 'direction'; // Yellow direction signs
  } else if (rawText.includes('{@L}') || rawText.includes('@L')) {
    signType = 'location'; // Black location signs with yellow text
  } else if (rawText.includes('{@B}') || rawText.includes('@B')) {
    signType = 'distance'; // Distance remaining signs
  }

  // Check for arrows
  const hasArrow = /\^[lrud]|\^lu|\^ld|\^ru|\^rd/.test(rawText);
  let arrowDirection: string | undefined;

  if (hasArrow) {
    const arrowMatch = rawText.match(/\^(lu|ld|ru|rd|[lrud])/);
    if (arrowMatch) {
      arrowDirection = arrowMatch[1];
    }
  }

  // Clean the text - remove formatting codes but keep meaningful content
  let cleanText = rawText
    // Replace arrow codes with actual arrow characters
    .replace(/\{\^lu\}|\^lu/g, '\u2196') // ↖
    .replace(/\{\^ru\}|\^ru/g, '\u2197') // ↗
    .replace(/\{\^ld\}|\^ld/g, '\u2199') // ↙
    .replace(/\{\^rd\}|\^rd/g, '\u2198') // ↘
    .replace(/\{\^l\}|\^l/g, '\u2190') // ←
    .replace(/\{\^r\}|\^r/g, '\u2192') // →
    .replace(/\{\^u\}|\^u/g, '\u2191') // ↑
    .replace(/\{\^d\}|\^d/g, '\u2193') // ↓
    // Remove sign type codes
    .replace(/\{@[YLRB]\d?\}/g, '')
    .replace(/@[YLRB]\d?/g, '')
    .replace(/\{@@\}/g, ' | ') // Back side separator
    .replace(/@@/g, ' | ')
    // Replace underscore with space (X-Plane convention)
    .replace(/_/g, ' ')
    // Remove remaining curly braces
    .replace(/\{[^}]*\}/g, '')
    // Clean up multiple spaces and trim
    .replace(/\s+/g, ' ')
    .trim();

  // If text is empty after cleaning, show original (cleaned of just brackets)
  if (!cleanText) {
    cleanText = rawText.replace(/[{}@^]/g, '').trim();
  }

  return {
    text: cleanText,
    signType,
    hasArrow,
    arrowDirection,
  };
}

/**
 * Legacy compatibility wrapper
 */
export function parseSignTextLegacy(rawText: string): { text: string; isYellow: boolean } {
  const parsed = parseSignText(rawText);
  // "isYellow" now means direction sign (yellow background) for backwards compat
  return {
    text: parsed.text,
    isYellow: parsed.signType === 'direction',
  };
}

export function getSignStyle(signSize: number): SignStyle {
  return SIGN_STYLES[signSize] ?? DEFAULT_SIGN_STYLE;
}

export function buildSignFontSizeExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'size']];

  for (const [size, style] of Object.entries(SIGN_STYLES)) {
    matchExpression.push(parseInt(size), style.fontSize);
  }

  matchExpression.push(DEFAULT_SIGN_STYLE.fontSize);
  return matchExpression as maplibregl.ExpressionSpecification;
}

export function buildSignHaloWidthExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'size']];

  for (const [size, style] of Object.entries(SIGN_STYLES)) {
    matchExpression.push(parseInt(size), style.haloWidth);
  }

  matchExpression.push(DEFAULT_SIGN_STYLE.haloWidth);
  return matchExpression as maplibregl.ExpressionSpecification;
}

export function getSignMinZoom(signSize: number): number {
  return getSignStyle(signSize).minZoom;
}
