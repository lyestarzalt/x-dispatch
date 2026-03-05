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
  <a href="https://discord.gg/gjpBhVjY"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
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

X-Plane has detailed airport diagrams but no global map to explore them. You need to already know the ICAO code to load an airport. I always wanted a world map to browse, search, and discover airports visually — so I built this.

Click any airport to see detailed diagrams with runways, taxiways, gates, and markings. Import your flight plan from SimBrief. Select a starting position, configure your flight, and launch X-Plane directly.

The app has grown to include SimBrief integration, live flight tracking, SID/STAR visualization, and an addon manager to keep your aircraft and scenery organized.

If you find this useful, consider giving it a ⭐, it helps others discover the project.

> **🍎 macOS Users (Sequoia/Tahoe):** The app is unsigned. To install:
>
> 1. Download the `.dmg` from [Releases](https://github.com/lyestarzalt/x-dispatch/releases/latest)
> 2. Drag to Applications and try to open - it will be blocked
> 3. Go to **System Settings → Privacy & Security** → scroll down
> 4. Click **"Open Anyway"** → enter your password
>
> **Or via Terminal:**
>
> ```bash
> xattr -rd com.apple.quarantine /Applications/X-Dispatch.app
> ```
>
> If you get "Permission denied", grant Terminal **Full Disk Access** in System Settings → Privacy & Security.

## Screenshots

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

### SimBrief Integration

- Import your latest OFP with one click
- Full route visualization on the map
- Fuel breakdown: block, taxi, enroute, reserves, contingency
- Weight summary: ZFW, TOW, landing weight
- Flight times and distance
- Aircraft and callsign info

### Addon Manager

- Browse aircraft and scenery from trusted sources
- One-click install and update
- Track installed addons and available updates
- Automatic extraction to correct X-Plane folders
- Support for ZIP, RAR, and 7z archives

### Airport Visualization

- Runways with surface types, dimensions, and lighting
- Taxiways, aprons, and pavement areas
- Runway and taxiway markings
- Signs, windsocks, and airport boundaries
- Runway, taxiway, and approach lighting systems
- Gates and parking positions with heading indicators

### Navigation Data

- VORs, NDBs, DMEs, and ILS/LOC with course lines
- Waypoints and fixes
- High and low altitude airways
- Controlled airspace boundaries
- SID, STAR, and approach procedures with route visualization

### Weather

- Live METAR with decoded wind, visibility, ceiling, clouds, temperature
- TAF forecasts
- Flight category display (VFR/MVFR/IFR/LIFR)

### Live Traffic

- Real-time VATSIM network overlay
- Pilot callsigns, aircraft types, and flight info

### Flight Launcher

- Aircraft browser with search and filtering
- Filter by manufacturer or category
- Favorites system
- Livery selection with previews
- Fuel load configuration
- Time of day with sun position arc
- Weather presets
- Start from any gate or runway
- Direct X-Plane launch

### Live Flight Tracking

- Real-time aircraft position via X-Plane WebSocket API
- Flight info strip: IAS, GS, ALT, AGL, VS, HDG
- Auto-center map on aircraft
- Connection status indicator

### Multiple Installations

- Automatic detection of X-Plane installations
- Easy switching between installations (Demo, Steam, etc.)
- Full data reload on installation change
- Navigraph data detection per installation

### Data Sources

- X-Plane native files (apt.dat, earth_nav.dat, earth_fix.dat, earth_awy.dat, CIFP)
- Navigraph nav data with AIRAC cycle detection
- ATC frequencies (Navigraph)
- Airport metadata with transition altitudes
- Custom scenery airport support

## How It Works

1. Point the app to your X-Plane installation
2. The app parses X-Plane's data files (apt.dat, nav data, CIFP procedures) and caches them
3. Browse the world map and click any airport
4. Import your flight plan from SimBrief or load an FMS file
5. Select a gate or runway, pick your aircraft, configure the flight
6. Launch X-Plane — or if it's already running, relocate mid-flight

Once flying, connect to X-Plane's WebSocket API to track your aircraft live on the map with speed, altitude, heading, and vertical speed indicators.

For addons, browse the catalog, click install, and the app handles downloading and extracting to the correct folder.

## Development

### Requirements

- Node.js 20+
- X-Plane 12.4+

### Setup

```bash
npm install
npm start
```

### Build

```bash
npm run make
```

## Support

- **Discord**: [Join the server](https://discord.gg/gjpBhVjY) for help, feedback, and discussion
- **Issues**: [Open an issue](https://github.com/lyestarzalt/x-dispatch/issues) for bug reports and feature requests
- **Donate**: If you enjoy X-Dispatch, consider [buying me a coffee on Ko-fi](https://ko-fi.com/lyestarzalt)

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
