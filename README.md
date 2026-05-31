<p align="center">
  <img src="assets/icon.png" alt="X-Dispatch" width="128">
</p>

<h1 align="center">X-Dispatch</h1>

<p align="center">
  Flight dispatch and airport visualization for X-Plane 12
</p>

<p align="center">
  Requires X-Plane 12.4+ · Windows · macOS · Linux
</p>

<p align="center">
  <a href="https://github.com/lyestarzalt/x-dispatch/releases/latest"><img src="https://img.shields.io/github/v/release/lyestarzalt/x-dispatch?style=flat-square&v=1" alt="Release"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/releases"><img src="https://img.shields.io/github/downloads/lyestarzalt/x-dispatch/total?style=flat-square&v=1" alt="Downloads"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lyestarzalt/x-dispatch?style=flat-square&v=1" alt="License"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/lyestarzalt/x-dispatch/ci.yml?style=flat-square&label=ci&v=1" alt="CI"></a>
  <a href="https://discord.gg/76UYpxXWW7"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://ko-fi.com/lyestarzalt"><img src="https://img.shields.io/badge/Ko--fi-Donate-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
  <a href="https://x-dispatch.app/download/">Download</a> · <a href="https://x-dispatch.app/">Website</a> · <a href="https://discord.gg/76UYpxXWW7">Discord</a>
</p>

---

![Map Overview](screenshots/map-overview.png)

All 35,000+ X-Plane airports on a 3D globe. Click one to see runways, taxiways, gates, and markings rendered from X-Plane's apt.dat. Set up your flight, import from SimBrief, and launch X-Plane directly.

## Screenshots

![Airport Detail](screenshots/airport-detail.png)
![Flight Setup](screenshots/flight-setup.png)

![3D Terrain](screenshots/3D-terrain.png)
![3D Terrain — Alt view](screenshots/3D-terrain-2.png)

<details>
<summary>More screenshots</summary>

![SimBrief Import](screenshots/simbrief-1.png)
![SimBrief Briefing](screenshots/simbrief-2.png)
![Flight Plan](screenshots/flight-plan.png)
![Fuel Setup](screenshots/fuel-setup.png)
![Weather Setup](screenshots/weather-setup.png)
![Starting Position](screenshots/starting-point-select.png)
![Addon Browser](screenshots/addon-manager-1.png)
![Addon Manager — Scenery](screenshots/addon-manager-2.png)
![Flight Tracking](screenshots/flight-tracking.png)
![Procedures](screenshots/procedures.png)
![Companion App](screenshots/companion-app.png)
![Settings](screenshots/settings.png)

</details>

## What it does

- **Airport map** — 35,000+ airports on a 3D globe with terrain and contour lines. Runways, taxiways, gates, helipads, markings, lights. Custom scenery detection.
- **Flight setup** — Pick your aircraft, livery, starting position, fuel, payload, weather. Launch X-Plane directly or relocate mid-flight.
- **Taxi routing** — Select a gate and runway, get a shortest-path taxi route. Drag to reroute through different taxiways.
- **SimBrief** — Import your OFP. Route goes on the map with fuel breakdown and nav log.
- **Nav data** — VORs, NDBs, ILS, airways, airspace, SID/STAR/approach procedures. Works with Navigraph.
- **Live traffic** — VATSIM and IVAO overlays. Live METAR per airport.
- **Flight tracking** — See your aircraft in real time with a flight strip.
- **Addon manager** — Browse installed aircraft, scenery, plugins. Drag-and-drop install. Scenery priority reordering.

10 languages. Requires X-Plane 12.4+. More details on the [project page](https://x-dispatch.app/).

> **Don't own X-Plane?** X-Plane has a [free demo](https://www.x-plane.com/desktop/try-it/) that works with X-Dispatch, so you can try both.

## Development

```bash
npm install           # install dependencies
npm start             # dev mode with hot reload
npm run start:clean   # fresh start (clears .vite cache)
npm run start:fresh   # dev mode with --reset-cache
npm run make          # build distributables
npm run typecheck     # TypeScript strict mode
npm run lint          # ESLint
npm run lint:fix      # auto-fix lint issues
npm run format        # Prettier
npm run check         # typecheck + lint + format + tests + migrations
npm run test:run      # run Vitest once
```

Electron + React 18 + TypeScript, MapLibre GL JS, Zustand, SQLite. Node.js 22+.

## Support

- [Discord](https://discord.gg/76UYpxXWW7)
- [Issues](https://github.com/lyestarzalt/x-dispatch/issues)

## Donate

X-Dispatch started as a passion project for the X-Plane community and continues to be built with that spirit in mind: free to use, community-focused, and developed in the open. Donations are entirely optional, but they help support continued development.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/A0A21V3IZZ)

## Disclaimer

References to X-Plane, SimBrief, Navigraph, VATSIM, and IVAO are for compatibility and identification purposes only. X-Dispatch is an independent community project and is not affiliated with, endorsed by, or sponsored by their respective owners.

## License

Licensed under GPL-3.0-only. See [LICENSE](LICENSE) for the full text.

<img src="https://hits.sh/github.com/lyestarzalt/x-dispatch.svg" alt="" width="1" height="1">
