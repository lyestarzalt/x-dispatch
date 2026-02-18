import type { SignSize } from '@/types/apt';
import { SIGN_CONFIG, getSignDimensions } from './config';
import type { SignSegment } from './types';

/**
 * Escape special XML characters for SVG text content
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculate the width of a text segment
 */
function calculateSegmentWidth(text: string, charWidth: number, padding: number): number {
  // Handle divider character (|) - it's narrower
  let width = 0;
  for (const char of text) {
    if (char === '|') {
      width += charWidth * 0.3;
    } else if (char === ' ') {
      width += charWidth * 0.5;
    } else {
      width += charWidth;
    }
  }
  return Math.round(width + padding * 2);
}

/**
 * Generate SVG string for a sign
 */
export function generateSignSVG(segments: SignSegment[], signSize: SignSize | number): string {
  if (segments.length === 0) {
    return '';
  }

  const dims = getSignDimensions(signSize);
  const { fontSize, padding, borderWidth, charWidth, height } = dims;

  // Calculate widths for each segment
  const segmentWidths = segments.map((seg) => calculateSegmentWidth(seg.text, charWidth, padding));

  // Total width including border
  const totalWidth = segmentWidths.reduce((sum, w) => sum + w, 0) + borderWidth * 2;

  // Determine outer border color (use first segment's border color)
  const firstSegmentColors = SIGN_CONFIG.colors[segments[0].type];

  // Start SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">`;

  // Draw each segment
  let x = borderWidth;
  segments.forEach((seg, i) => {
    const colors = SIGN_CONFIG.colors[seg.type];
    const w = segmentWidths[i];

    // Background rectangle
    svg += `<rect x="${x}" y="${borderWidth}" width="${w}" height="${height - borderWidth * 2}" fill="${colors.bg}"/>`;

    // Text - need to handle dividers specially
    const textParts = seg.text.split('|');
    if (textParts.length > 1) {
      // Has dividers - render each part with divider lines
      let textX = x;
      textParts.forEach((part, partIdx) => {
        const partWidth = calculateSegmentWidth(part, charWidth, 0);

        if (partIdx === 0) {
          textX += padding;
        }

        // Draw text part
        if (part) {
          svg += `<text x="${textX + partWidth / 2}" y="${height / 2}" fill="${colors.text}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${escapeXml(part)}</text>`;
        }

        textX += partWidth;

        // Draw divider line (if not last part)
        if (partIdx < textParts.length - 1) {
          const dividerX = textX + charWidth * 0.15;
          svg += `<line x1="${dividerX}" y1="${borderWidth + 2}" x2="${dividerX}" y2="${height - borderWidth - 2}" stroke="${colors.text}" stroke-width="2"/>`;
          textX += charWidth * 0.3;
        }
      });
    } else {
      // No dividers - simple centered text
      const textX = x + w / 2;
      svg += `<text x="${textX}" y="${height / 2}" fill="${colors.text}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${escapeXml(seg.text)}</text>`;
    }

    // Segment border (between segments)
    if (i > 0) {
      svg += `<line x1="${x}" y1="${borderWidth}" x2="${x}" y2="${height - borderWidth}" stroke="${colors.border}" stroke-width="1"/>`;
    }

    x += w;
  });

  // Outer border
  svg += `<rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${totalWidth - borderWidth}" height="${height - borderWidth}" fill="none" stroke="${firstSegmentColors.border}" stroke-width="${borderWidth}"/>`;

  svg += '</svg>';

  return svg;
}

/**
 * Convert SVG string to data URI
 */
export function svgToDataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Load SVG as HTMLImageElement (returns a Promise)
 */
export function loadSvgAsImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = svgToDataUri(svg);
  });
}

/**
 * Generate sign image and return as HTMLImageElement
 */
export async function generateSignImage(
  segments: SignSegment[],
  signSize: SignSize | number
): Promise<HTMLImageElement> {
  const svg = generateSignSVG(segments, signSize);
  return loadSvgAsImage(svg);
}
