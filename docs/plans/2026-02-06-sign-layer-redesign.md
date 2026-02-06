# Sign Layer Redesign - SVG Generation

## Overview

Replace current text+halo sign rendering with dynamically generated SVG images that look like real airport signs with proper rectangular backgrounds and multi-segment support.

## Current State

Signs render as floating text labels with halo effects - confusing and don't look like actual airport signs.

## Goal

Generate proper rectangular sign images matching FAA/X-Plane standards:

- Location signs: Black background, yellow text, yellow border
- Direction signs: Yellow background, black text
- Mandatory signs: Red background, white text
- Multi-segment signs rendered as connected rectangles

## Design

### Sign Parsing

Parse X-Plane sign text into segments based on color directives:

| Directive | Background | Text   | Supported  |
| --------- | ---------- | ------ | ---------- |
| `@Y`      | Yellow     | Black  | All glyphs |
| `@R`      | Red        | White  | All glyphs |
| `@L`      | Black      | Yellow | A-Z, 0-9   |
| `@B`      | Black      | White  | 0-9        |

Example: `{@L}B6{@Y}C2{^r}` → `[{type:'L', text:'B6'}, {type:'Y', text:'C2→'}]`

Glyph conversions:

- `^u` `^d` `^l` `^r` → ↑ ↓ ← →
- `^lu` `^ru` `^ld` `^rd` → ↖ ↗ ↙ ↘
- `r1` `r2` `r3` → Ⅰ Ⅱ Ⅲ
- `_` → space
- `|` → vertical divider line within segment
- `{@@}` → front/back separator (only render front)

### SVG Generation

Generate SVG string with rectangles and text for each segment:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="28">
  <rect x="2" y="2" width="36" height="24" fill="#000"/>
  <text x="20" y="14" fill="#FFCC00">B6</text>
  <rect x="38" y="2" width="40" height="24" fill="#FFCC00"/>
  <text x="58" y="14" fill="#000">C2→</text>
  <rect x="0" y="0" width="80" height="28" fill="none" stroke="#FFCC00" stroke-width="2"/>
</svg>
```

### Configuration

Single config object for easy tweaking:

```typescript
const SIGN_CONFIG = {
  scale: 1.0, // Master scale multiplier
  baseFontSize: 16,
  basePadding: 4,
  baseBorderWidth: 2,
  baseCharWidth: 10,

  sizeMultipliers: {
    // apt.dat sign sizes 1-5
    1: 0.7,
    2: 1.0,
    3: 1.4,
    4: 1.4,
    5: 0.7,
  },

  colors: {
    Y: { bg: '#FFCC00', text: '#000000', border: '#000000' },
    R: { bg: '#CC0000', text: '#FFFFFF', border: '#000000' },
    L: { bg: '#000000', text: '#FFCC00', border: '#FFCC00' },
    B: { bg: '#000000', text: '#FFFFFF', border: '#FFFFFF' },
  },
};
```

### MapLibre Integration

Use `styleimagemissing` event for lazy loading:

1. Each sign feature has `imageId` property encoding its segments
2. When MapLibre needs the image, generate SVG on demand
3. Convert SVG to data URI, load as Image, call `addImage()`
4. Identical signs share the same image automatically

Image ID format: `sign-{size}-{segments}` (e.g., `sign-2-L:B6,Y:C2→`)

### File Structure

```
src/lib/signRenderer/
├── index.ts           # Main exports
├── types.ts           # SignSegment, ParsedSign interfaces
├── config.ts          # SIGN_CONFIG
├── parser.ts          # parseSignText() → segments
└── svgGenerator.ts    # generateSignSVG(), loadSvgAsImage()

src/components/Map/layers/airport/
└── SignLayer.ts       # Updated to use signRenderer
```

## Implementation Steps

1. Create `lib/signRenderer/types.ts` - interfaces
2. Create `lib/signRenderer/config.ts` - SIGN_CONFIG
3. Create `lib/signRenderer/parser.ts` - segment parsing
4. Create `lib/signRenderer/svgGenerator.ts` - SVG generation
5. Update `SignLayer.ts` - use new renderer with styleimagemissing
6. Remove old parsing from `signStyles.ts`

## Out of Scope

- Interactive hover/click (can add later)
- Back of sign rendering (front only for 2D map)
- Fixed glyphs as icons (hazard, safety, etc.) - treat as text for now
