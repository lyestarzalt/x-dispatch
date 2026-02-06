import type { ParsedSign, SignColorMode, SignSegment } from './types';

const GLYPH_MAP: Record<string, string> = {
  '^u': '↑',
  '^d': '↓',
  '^l': '←',
  '^r': '→',
  '^lu': '↖',
  '^ru': '↗',
  '^ld': '↙',
  '^rd': '↘',
  r1: 'Ⅰ',
  r2: 'Ⅱ',
  r3: 'Ⅲ',
  'no-entry': '⊘',
  critical: '◈',
  safety: '▣',
  hazard: '⚠',
  comma: ',',
};

function isColorDirective(s: string): s is SignColorMode {
  return s === 'Y' || s === 'R' || s === 'L' || s === 'B';
}

/**
 * Parse X-Plane sign text into segments
 *
 * Examples:
 * - `{@L}A` → [{type:'L', text:'A'}]
 * - `{@L}B6{@Y}C2{^r}` → [{type:'L', text:'B6'}, {type:'Y', text:'C2→'}]
 * - `{@Y,^l,C}` → [{type:'Y', text:'←C'}] (comma-delimited)
 * - `{@L}A{@@}{@Y}B` → front:[{type:'L', text:'A'}], back:[{type:'Y', text:'B'}]
 */
export function parseSignText(rawText: string): ParsedSign {
  // Split front and back on {@@} or @@
  const backSeparator = rawText.indexOf('{@@}');
  const backSeparatorAlt = rawText.indexOf('@@');

  let frontText: string;
  let backText: string;

  if (backSeparator !== -1) {
    frontText = rawText.slice(0, backSeparator);
    backText = rawText.slice(backSeparator + 4);
  } else if (backSeparatorAlt !== -1 && !rawText.includes('{@@}')) {
    frontText = rawText.slice(0, backSeparatorAlt);
    backText = rawText.slice(backSeparatorAlt + 2);
  } else {
    frontText = rawText;
    backText = '';
  }

  return {
    front: parseSignSide(frontText),
    back: backText ? parseSignSide(backText) : [],
  };
}

/**
 * Parse one side of a sign (front or back) into segments
 */
function parseSignSide(text: string): SignSegment[] {
  // Check for comma-delimited syntax: {@Y,^l,C}
  const commaMatch = text.match(/^\{@([YRLB]),(.+)\}$/);
  if (commaMatch) {
    return parseCommaDelimited(commaMatch[1] as SignColorMode, commaMatch[2]);
  }

  const segments: SignSegment[] = [];
  let currentMode: SignColorMode = 'L'; // Default to location if no directive
  let currentText = '';
  let i = 0;

  while (i < text.length) {
    // Check for bracketed content
    if (text[i] === '{') {
      const closeIdx = text.indexOf('}', i);
      if (closeIdx === -1) {
        // Malformed, treat rest as text
        currentText += text.slice(i);
        break;
      }

      const content = text.slice(i + 1, closeIdx);

      // Color directive: @Y, @R, @L, @B
      if (content.startsWith('@') && content.length === 2) {
        const mode = content[1];
        if (isColorDirective(mode)) {
          // Save current segment if there's text
          if (currentText) {
            segments.push({ type: currentMode, text: currentText });
            currentText = '';
          }
          currentMode = mode;
        }
      }
      // Multi-char glyph
      else if (GLYPH_MAP[content]) {
        currentText += GLYPH_MAP[content];
      }
      // Unknown bracketed content - skip
      else {
        // Could be {@@} handled above, or invalid
      }

      i = closeIdx + 1;
    }
    // Standalone @ directive (without braces): @Y, @R, @L, @B
    else if (text[i] === '@' && i + 1 < text.length) {
      const mode = text[i + 1];
      if (isColorDirective(mode)) {
        if (currentText) {
          segments.push({ type: currentMode, text: currentText });
          currentText = '';
        }
        currentMode = mode;
        i += 2;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Standalone ^ glyph codes (without braces)
    else if (text[i] === '^' && i + 1 < text.length) {
      // Try 2-char codes first (lu, ru, ld, rd)
      const twoChar = text.slice(i, i + 3);
      if (GLYPH_MAP[twoChar.slice(1)]) {
        // Check ^lu, ^ru, etc.
        const code = twoChar.slice(1);
        if (GLYPH_MAP[`^${code}`] || GLYPH_MAP[code]) {
          currentText += GLYPH_MAP[code] || GLYPH_MAP[`^${code}`];
          i += 3;
          continue;
        }
      }
      // Try single char codes (u, d, l, r)
      const oneChar = text.slice(i, i + 2);
      const code = oneChar.slice(1);
      if (GLYPH_MAP[`^${code}`]) {
        currentText += GLYPH_MAP[`^${code}`];
        i += 2;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Underscore = space
    else if (text[i] === '_') {
      currentText += ' ';
      i++;
    }
    // Asterisk = dot
    else if (text[i] === '*') {
      currentText += '•';
      i++;
    }
    // Pipe = divider (keep as |, will render as line in SVG)
    else if (text[i] === '|') {
      currentText += '|';
      i++;
    }
    // Regular character
    else {
      currentText += text[i];
      i++;
    }
  }

  // Push final segment
  if (currentText) {
    segments.push({ type: currentMode, text: currentText });
  }

  return segments;
}

/**
 * Parse comma-delimited syntax: @Y,^l,C,|,D
 */
function parseCommaDelimited(mode: SignColorMode, content: string): SignSegment[] {
  const parts = content.split(',');
  let text = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (GLYPH_MAP[trimmed]) {
      text += GLYPH_MAP[trimmed];
    } else if (trimmed === '_') {
      text += ' ';
    } else if (trimmed === '*') {
      text += '•';
    } else {
      text += trimmed;
    }
  }

  return text ? [{ type: mode, text }] : [];
}

/**
 * Generate a cache key for a parsed sign
 * Format: "L:B6,Y:C2→" for front segments
 */
export function generateSignCacheKey(segments: SignSegment[], size: number): string {
  const encoded = segments.map((s) => `${s.type}:${s.text}`).join(',');
  return `sign-${size}-${encoded}`;
}

/**
 * Decode a cache key back to segments and size
 */
export function decodeSignCacheKey(key: string): { segments: SignSegment[]; size: number } | null {
  const match = key.match(/^sign-(\d+)-(.+)$/);
  if (!match) return null;

  const size = parseInt(match[1], 10);
  const encoded = match[2];

  const segments: SignSegment[] = encoded.split(',').map((part) => {
    const [type, ...textParts] = part.split(':');
    return {
      type: type as SignColorMode,
      text: textParts.join(':'), // Rejoin in case text had colons
    };
  });

  return { segments, size };
}
