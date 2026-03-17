# X-Dispatch - Claude Code Guidelines
xp path '/Users/lyes.t/Library/Application Support/Steam/steamapps/common/X-Plane 12'

TODO:
Cannot read properties of undefined (reading 'getLayer')
ramp_start doesn't handle duplicate gate names — lle_ground_start had offset bug, using ramp_start as workaround
Switching to another airport mid-flight does not render the ground

Livery not applied on cold launch (--new_flight_json):
  User selects a non-default livery (e.g. H145 "HB-ZQG") but X-Plane starts with a different one.
  Works correctly via REST API "Change Flight" (POST /flight with { data: payload }).
  Cold start writes the same FlightInit JSON to /tmp/x-dispatch-flight.json and passes
  --new_flight_json=path to X-Plane CLI. On macOS+Steam the path is URL-encoded via
  steam://rungameid/<appId>//<args>/. Suspect X-Plane's CLI doesn't respect the livery
  field the same way as the REST API, or the Steam URL encoding is corrupting the path.
  Files: LaunchDialog/index.tsx (buildFlightAPIPayload, line ~184), launch/index.ts (line ~82-160)

Persist aircraft list filters across sessions:
  AircraftList.tsx uses local useState for all filters — they reset when the dialog closes.
  Move to launchStore (already has persist middleware, version 4, localStorage key 'launch-store'):
    - searchQuery (string)
    - filterCategory (string, derived from aircraft path)
    - filterManufacturer (string)
    - filterAircraftType ('all' | 'fixed-wing' | 'helicopter')
    - filterEngineType ('all' | 'jet' | 'prop')
    - showFavoritesOnly (boolean)
  Add to partialize, bump version to 5, add migration.
  Files: stores/launchStore.ts, LaunchDialog/components/AircraftList.tsx, LaunchDialog/types.ts




## Project Overview

X-Dispatch is an Electron desktop application for X-Plane flight simulation. It provides airport visualization, flight dispatch, and navigation data management.

## Tech Stack

- **Framework**: Electron + React 18 + TypeScript
- **Build**: Vite + Electron Forge
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: Zustand stores
- **Data Fetching**: TanStack Query (React Query)
- **Map**: MapLibre GL JS
- **Database**: SQLite (better-sqlite3)

## Directory Structure

```
src/
├── components/
│   ├── Map/
│   │   ├── hooks/          # Map-specific React hooks
│   │   ├── layers/         # MapLibre layer renderers
│   │   │   ├── airport/    # Airport feature layers (runways, taxiways, etc.)
│   │   │   ├── navigation/ # Nav data layers (VOR, NDB, airways, etc.)
│   │   │   ├── airspace/   # Airspace boundary layers
│   │   │   ├── dynamic/    # Real-time overlay layers (VATSIM, procedures)
│   │   │   └── types.ts    # Shared layer utilities
│   │   ├── utils/          # Map utilities
│   │   └── widgets/        # Map UI widgets
│   ├── dialogs/            # Modal dialogs
│   ├── layout/             # Layout components (Sidebar, Toolbar)
│   ├── panels/             # Content panels
│   ├── screens/            # Full-screen views
│   └── ui/                 # shadcn/ui components
├── config/                 # Configuration constants
├── hooks/                  # Global React hooks
├── lib/
│   ├── aptParser/          # X-Plane apt.dat parser
│   ├── navParser/          # Navigation data parsers
│   ├── xplaneData/         # X-Plane data management
│   ├── launcher/           # X-Plane launch integration
│   └── geo/                # Geographic calculations
├── queries/                # TanStack Query hooks
├── stores/                 # Zustand state stores
├── types/                  # TypeScript type definitions
└── db/                     # SQLite database schema
```

## Map Layer Architecture

### Layer Categories

1. **Airport Layers** (`layers/airport/`) - Render parsed apt.dat features
   - Use `BaseLayerRenderer` class pattern
   - Receive `ParsedAirport` data

2. **Navigation Layers** (`layers/navigation/`) - Render nav data arrays
   - Use `NavLayerRenderer<T>` generic base class
   - Support async image loading and incremental updates

3. **Airspace Layers** (`layers/airspace/`) - Render airspace boundaries
   - Use `NavLayerRenderer<Airspace>` base class

4. **Dynamic Layers** (`layers/dynamic/`) - Real-time overlays
   - Function-based (custom parameters)
   - VATSIM traffic, procedure routes

### NavLayerRenderer Pattern

Navigation layers extend `NavLayerRenderer<T>`:

```typescript
export class VORLayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-vors';
  readonly sourceId = 'nav-vors-source';
  readonly additionalLayerIds = ['nav-vors-labels'];

  protected createGeoJSON(data: Navaid[]): GeoJSON.FeatureCollection {
    // Convert data to GeoJSON
  }

  protected addLayers(map: maplibregl.Map): void {
    // Add MapLibre layers
  }

  // Optional: override for custom image loading
  protected async loadImages(map: maplibregl.Map): Promise<boolean> {
    // Load SVG symbols
  }
}

// Singleton + legacy exports for backward compatibility
const vorLayer = new VORLayerRenderer();
export function addVORLayer(map: maplibregl.Map, vors: Navaid[]): Promise<void> {
  return vorLayer.add(map, vors);
}
export const VOR_LAYER_IDS = vorLayer.getAllLayerIds();
```

### Layer Naming Convention

- Layer IDs: `nav-{type}` (e.g., `nav-vors`, `nav-ndbs`)
- Source IDs: `nav-{type}-source`
- Label layers: `nav-{type}-labels`
- Export: `{TYPE}_LAYER_IDS` array

### Shared Layer Utilities

Use helpers from `layers/types.ts`:

```typescript
import { removeLayersAndSource, setLayersVisibility } from '../types';
```

## Coding Conventions

### TypeScript

- Strict mode enabled
- Use `type` imports for type-only imports
- Prefer interfaces for object shapes, types for unions

### React

- Functional components only
- Use custom hooks for complex logic
- Zustand for global state, useState for local

### Typography & Sizing (MANDATORY)

All text sizing MUST use the design system utility classes or their equivalent Tailwind tokens. **Never invent arbitrary sizes.** Check `src/index.css` and existing components first.

| Role | Class / Tokens | When to use |
|------|---------------|-------------|
| Section heading | `.xp-section-heading` or `text-xs uppercase tracking-wider text-muted-foreground` | Section dividers |
| Label | `.xp-label` or `text-sm text-muted-foreground` | Field labels, row labels |
| Value | `.xp-value` or `font-mono text-sm text-foreground` | Data readouts |
| Value (accent) | `.xp-value-primary` or `font-mono text-sm text-primary` | Highlighted values |
| Supporting text | `text-xs text-muted-foreground` | ISA offsets, alt units, hints below sliders |
| Toggle/button text | `text-sm` (default from toggle/button variants) | Interactive controls |
| Small icon+label toggles | `text-xs` with `truncate` | Weather grid icons, compact pill toggles |
| Icons in labels | `h-4 w-4` | Standard for all label-adjacent icons |
| Icons in compact buttons | `h-3.5 w-3.5` | Only in small action buttons (close, add) |

**i18n overflow rule**: Any text from `t()` that could vary in length across locales MUST use `truncate` (or `line-clamp-1`) and its parent MUST have `min-w-0` or a fixed width. Never assume English string lengths. **Flexbox gotcha**: `flex-1` alone does NOT prevent overflow — flex items default to `min-width: auto` (content width). Always pair `flex-1` with `min-w-0` when the content includes translated text or dynamic strings, otherwise long text pushes the element wider than its share.

### Dialog Sizing (MANDATORY)

All full-screen dialogs (multi-panel layouts like LaunchDialog, WeatherDialog) MUST use `fixed inset-6` for equal 24px margins from all screen edges. This replaces the old `left-[50%] top-[50%] translate w-[Xvw] h-[Yvh]` pattern which created unequal margins and broke on 1080p screens.

- **Full-screen dialogs**: `fixed inset-6` — no translate, no vw/vh percentages, no max-w
- **Focused dialogs** (e.g. WeightBalance): centered with `left-[50%] top-[50%] -translate-x/y-1/2` + `max-w-[calc(100vw-3rem)] max-h-[calc(100vh-3rem)]` to enforce the same 1.5rem minimum margin
- **Never use** `w-[95vw] h-[90vh]` or similar mismatched percentage pairs

### Multi-Panel Flex Layouts (MANDATORY)

In side-by-side panel layouts (e.g., LaunchDialog's 3 panels, AddonManager sidebar + content), side panels with fixed widths (`w-[320px]`, `w-56`, `w-72`) **MUST have `shrink-0`** to prevent compression on small viewports or high-DPI scaled screens. Only the main content area should use `flex-1` (and always pair with `min-w-0`).

- **Side panels**: `w-[320px] shrink-0` — never compress, content stays visible
- **Main content area**: `flex-1 min-w-0` — flexes to fill remaining space, `min-w-0` prevents overflow
- **Why**: On Windows at 125%/150% display scaling, effective CSS viewport shrinks (1920×1080 at 150% = 1280×720 CSS pixels). Without `shrink-0`, flex items compress below their intended width, clipping buttons and controls.
- **Minimum window size**: `minWidth: 1024, minHeight: 640` in `main.ts` BrowserWindow options

### Commits

- **Never add co-author lines** to commit messages
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`

### File Organization

- One component per file
- Index files for folder exports
- Colocate tests with source files

## Common Commands

```bash
npm start           # Development mode
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run lint:fix    # Auto-fix lint issues
npm run format      # Prettier format
npm run make        # Build distributables
```

## Key Files

- `src/main.ts` - Electron main process
- `src/renderer.tsx` - React entry point
- `src/preload.ts` - Electron preload (IPC bridge)
- `src/lib/xplaneData/XPlaneDataManager.ts` - Navigation data loading
- `src/lib/aptParser/` - X-Plane apt.dat parser (see APT_DAT_PARSING.md)
- `src/components/Map/index.tsx` - Main map component

## apt.dat Bezier Parsing (Critical)

**See `.claude/APT_DAT_PARSING.md` for full documentation.**

Pavement/taxiway shapes use bezier curves. Key points:

- **Row codes**: 111 (plain), 112 (bezier), 113/114 (ring close), 115/116 (string end)
- **112 node** has control point defining curve direction LEAVING that node
- **111 → 112**: Quadratic bezier, MIRROR control to get incoming tangent
- **112 → 112**: Cubic bezier with 4 control points
- **112 → 111**: Quadratic bezier using outgoing control directly
- **Split beziers**: Same position with different controls = sharp corner, skip degenerate curve
- **Resolution**: `DEFAULT_BEZIER_RESOLUTION = 128` in `bezier.ts`
- **Types**: Use `LonLat` from `@/types/geo` for coordinates

## Navigation Data Types

```typescript
// Core types from src/types/navigation.ts
interface Navaid { id, name, type, latitude, longitude, frequency, bearing? }
interface Waypoint { id, region, latitude, longitude }
interface AirwaySegment { name, fromFix, toFix, baseFl, topFl }
interface Airspace { name, class, coordinates, upperLimit, lowerLimit }
```

## State Stores

- `appStore` - App-wide state (selected airport, loading)
- `mapStore` - Map state (center, zoom, layers visibility)
- `settingsStore` - User settings (X-Plane path, preferences)
- `themeStore` - Theme preferences

## Available Skills

| Skill | Description | Usage |
|-------|-------------|-------|
| `/create-nav-layer` | Create navigation layer with NavLayerRenderer | `/create-nav-layer MarkerLayer Marker` |
| `/create-airport-layer` | Create airport layer with BaseLayerRenderer | `/create-airport-layer Helipad` |
| `/commit` | Git commit without co-author | `/commit` or `/commit fix typo` |
| `/pr` | Create GitHub pull request | `/pr` or `/pr develop` |
| `/check` | Run typecheck and lint | `/check` |
