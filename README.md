<p align="center">
  <img src="assets/icon.png" alt="X-Dispatch" width="128">
</p>

<h1 align="center">X-Dispatch</h1>

<p align="center">
  Flight dispatch, airport visualization, and addon management for X-Plane 12
</p>

<p align="center">
  <a href="https://github.com/lyestarzalt/x-dispatch/releases/latest"><img src="https://img.shields.io/github/v/release/lyestarzalt/x-dispatch?style=flat-square&v=1" alt="Release"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/releases"><img src="https://img.shields.io/github/downloads/lyestarzalt/x-dispatch/total?style=flat-square&v=1" alt="Downloads"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lyestarzalt/x-dispatch?style=flat-square&v=1" alt="License"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/actions"><img src="https://img.shields.io/github/actions/workflow/status/lyestarzalt/x-dispatch/check.yml?style=flat-square&label=checks&v=1" alt="CI"></a>
  <a href="https://discord.gg/7QBCNv8B"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://ko-fi.com/lyestarzalt"><img src="https://img.shields.io/badge/Ko--fi-Donate-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MapLibre-396CB2?style=flat-square&logo=maplibre&logoColor=white" alt="MapLibre">
</p>

<p align="center">
  <a href="https://github.com/lyestarzalt/x-dispatch/releases/latest">Download for Windows, macOS, Linux</a>
</p>

---

![Map Overview](screenshots/map-overview.png)

X-Plane has detailed airport data but no global map to explore it. X-Dispatch gives you a 3D globe to browse, search, and discover airports visually. Click any airport to see detailed diagrams with runways, taxiways, gates, and markings. Import your flight plan from SimBrief, select a starting position, configure your flight, and launch X-Plane directly.

If you find this useful, consider giving it a star — it helps others discover the project.

> **macOS Users (Sequoia/Tahoe):** The app is unsigned. After installing, go to **System Settings > Privacy & Security** and click **"Open Anyway"**, or run:
>
> ```bash
> xattr -rd com.apple.quarantine /Applications/X-Dispatch.app
> ```

## Screenshots

![Airport Detail](screenshots/airport-detail.png)
![Flight Setup](screenshots/flight-setup.png)

<details>
<summary>SimBrief Integration</summary>

![SimBrief Import](screenshots/simbrief-1.png)
![SimBrief Flight Info](screenshots/simbrief-2.png)

</details>

<details>
<summary>Addon Manager</summary>

![Addon Browser](screenshots/addon-manager-1.png)
![Addon Details](screenshots/addon-manager-2.png)

</details>

<details>
<summary>Airport Detail View</summary>

![Airport Detail](screenshots/airport-detail.png)

</details>

<details>
<summary>SID/STAR Procedures</summary>

![Procedures](screenshots/procedures.png)

</details>

<details>
<summary>Starting Position</summary>

![Starting Point](screenshots/starting-point-select.png)

</details>

<details>
<summary>Flight Setup</summary>

![Flight Setup](screenshots/flight-setup.png)

</details>

<details>
<summary>Fuel & Payload</summary>

![Fuel Setup](screenshots/fuel-setup.png)

</details>

<details>
<summary>Weather Setup</summary>

![Weather Setup](screenshots/weather-setup.png)

</details>

<details>
<summary>3D Terrain</summary>

![3D Terrain](screenshots/3D-terrain.png)

</details>

<details>
<summary>Live Flight Tracking</summary>

![Flight Tracking](screenshots/track-plane.png)

</details>

<details>
<summary>Flight Plan</summary>

![Flight Plan](screenshots/flight-plan.png)

</details>

<details>
<summary>Settings</summary>

![Settings](screenshots/settings.png)

</details>

## Features

### Map & Visualization

- 3D globe with starfield background, terrain elevation, hillshade, and contour lines
- 6 basemap styles (OpenFreeMap, CARTO dark/light variants)
- Airport dots for 35,000+ airports with custom scenery support
- Airport filters by type, runway surface, and country
- Day/night terminator overlay
- Weather radar overlay (RainViewer) with playback controls
- Interactive drag-to-resize range rings with category presets
- Idle orbit camera for selected airports

### Airport Details

- Runways with surface types, dimensions, lighting, and markings
- Taxiways, aprons, and pavement areas with signs
- Gates and parking positions with heading indicators
- Helipads, windsocks, and beacons

### Navigation Data

- VOR, NDB, DME, TACAN, and ILS/LOC with course visualization
- High and low altitude airways
- Controlled airspace boundaries and FIR regions
- SID, STAR, and approach procedures with route overlay
- Range rings showing aircraft reach by category (jet, turboprop, GA)
- X-Plane native data or Navigraph with AIRAC cycle detection

### SimBrief Integration

- One-click OFP import with route visualization on the map
- Fuel breakdown, weight summary, flight times, and nav log
- Waypoint-by-waypoint navigation with map highlighting

### Live Traffic

- VATSIM and IVAO network overlays with pilot callsigns and aircraft types
- Controller and ATIS positions
- Live METAR with decoded weather and flight category display (VFR/MVFR/IFR/LIFR)

### Flight Launcher

- Aircraft browser with search, filters, and favorites
- Livery selection with per-aircraft memory
- Fuel and payload configuration with weight & balance
- Time of day, weather presets, and cold & dark start
- Start from any gate, runway, helipad, or custom pin drop with coordinates
- Air start, carrier catapult, and frigate deck launch modes
- Runway approach start with configurable distance and glider tow
- Direct X-Plane launch or mid-flight relocation via REST API
- Logbook of last 10 flights

### Live Flight Tracking

- Real-time aircraft position via X-Plane WebSocket API
- Flight strip with IAS, GS, altitude, VS, heading, wind, and temperature
- Follow mode to keep the aircraft centered on the map

### Multiple Installations

- Named X-Plane installations with quick switching
- Full data reload on installation change
- Symlink and junction support for addons on external drives
- Version and Steam detection per installation

### Addon Manager

- Browse installed aircraft, plugins, liveries, and Lua scripts
- Scenery priority manager with drag-to-reorder and auto-sort
- One-click install with automatic extraction (ZIP, RAR, 7z)
- Delete scenery from disk with confirmation
- Detects manually added scenery and new addons on rescan

### General

- `xdispatch://` deep link protocol for airport navigation
- Available in 10 languages: English, French, German, Spanish, Italian, Portuguese, Russian, Polish, Japanese, Chinese
- Light, dark, and system theme
- Configurable interface zoom and font size
- Keyboard shortcuts (Ctrl+F for search)

## Development

```bash
npm install      # install dependencies
npm start        # dev mode with hot reload
npm run make     # build distributables
```

```bash
npm run typecheck   # TypeScript strict checks
npm run lint        # ESLint
npm run lint:fix    # auto-fix lint issues
npm run format      # Prettier
```

### Tech Stack

| Layer         | Technology                       |
| ------------- | -------------------------------- |
| Framework     | Electron + React 18 + TypeScript |
| Build         | Vite + Electron Forge            |
| UI            | Tailwind CSS + shadcn/ui         |
| State         | Zustand (persisted stores)       |
| Data Fetching | TanStack Query                   |
| Map           | MapLibre GL JS                   |
| Database      | SQLite (sql.js)                  |

### Project Structure

```
src/
├── components/       # React components (Map, dialogs, panels, layout)
├── config/           # Map styles, zoom behaviors, surface colors
├── hooks/            # Global React hooks
├── lib/
│   ├── parsers/      # X-Plane apt.dat, nav data, METAR, FMS parsers
│   ├── addonManager/ # Aircraft, scenery, plugin management
│   ├── xplaneServices/ # X-Plane REST/WebSocket integration
│   └── geo/          # Geographic calculations
├── queries/          # TanStack Query hooks
├── stores/           # Zustand state stores
├── types/            # TypeScript type definitions
└── db/               # SQLite schema and migrations
```

Requires Node.js 20+ and X-Plane 12.1+.

## Support

- **Discord**: [Join the server](https://discord.gg/7QBCNv8B) for help, feedback, and discussion
- **Issues**: [Open an issue](https://github.com/lyestarzalt/x-dispatch/issues) for bug reports and feature requests
- **Donate**: If you enjoy X-Dispatch, consider [supporting on Ko-fi](https://ko-fi.com/lyestarzalt)

## License

GPL-3.0 — See [LICENSE](LICENSE) for details.
