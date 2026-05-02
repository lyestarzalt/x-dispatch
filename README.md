<p align="center">
  <img src="assets/icon.png" alt="X-Dispatch" width="128">
</p>

<h1 align="center">X-Dispatch</h1>

<p align="center">
  Flight dispatch and airport visualization for X-Plane 12
</p>

<p align="center">
  <a href="https://github.com/lyestarzalt/x-dispatch/releases/latest"><img src="https://img.shields.io/github/v/release/lyestarzalt/x-dispatch?style=flat-square&v=1" alt="Release"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/releases"><img src="https://img.shields.io/github/downloads/lyestarzalt/x-dispatch/total?style=flat-square&v=1" alt="Downloads"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lyestarzalt/x-dispatch?style=flat-square&v=1" alt="License"></a>
  <a href="https://github.com/lyestarzalt/x-dispatch/actions"><img src="https://img.shields.io/github/actions/workflow/status/lyestarzalt/x-dispatch/check.yml?style=flat-square&label=checks&v=1" alt="CI"></a>
  <a href="https://discord.gg/76UYpxXWW7"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://ko-fi.com/lyestarzalt"><img src="https://img.shields.io/badge/Ko--fi-Donate-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
  <a href="https://hits.sh/github.com/lyestarzalt/x-dispatch/"><img src="https://hits.sh/github.com/lyestarzalt/x-dispatch.svg" alt="Hits"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MapLibre-396CB2?style=flat-square&logo=maplibre&logoColor=white" alt="MapLibre">
</p>

<p align="center">
  <a href="https://github.com/lyestarzalt/x-dispatch/releases/latest">Download</a> · <a href="https://tarzalt.dev/projects/x-dispatch/">Website</a> · <a href="https://discord.gg/76UYpxXWW7">Discord</a>
</p>

---

![Map Overview](screenshots/map-overview.png)

All 35,000+ X-Plane airports on a 3D globe. Click one to see runways, taxiways, gates, and markings rendered from X-Plane's apt.dat. Set up your flight, import from SimBrief, and launch X-Plane directly.

> **Download:** grab the installer for your OS from the [Releases page](https://github.com/lyestarzalt/x-dispatch/releases/latest) (`.dmg` for macOS, `.exe` for Windows, `.AppImage` for Linux).

> **macOS:** The app is unsigned. Go to **System Settings > Privacy & Security** and click **"Open Anyway"**, or run:
>
> ```bash
> xattr -rd com.apple.quarantine /Applications/X-Dispatch.app
> ```

> **Windows:** If X-Plane doesn't launch, try running X-Dispatch as administrator.

## Screenshots

![Airport Detail](screenshots/airport-detail.png)
![Flight Setup](screenshots/flight-setup.png)

![3D Terrain](screenshots/3D-terrain.png)

<details>
<summary>More screenshots</summary>

![SimBrief Import](screenshots/simbrief-1.png)
![Addon Browser](screenshots/addon-manager-1.png)
![Flight Tracking](screenshots/track-plane.png)
![Procedures](screenshots/procedures.png)

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

10 languages. Requires X-Plane 12.4+. More details on the [project page](https://tarzalt.dev/projects/x-dispatch/).

> **Don't own X-Plane?** X-Plane has a [free demo](https://www.x-plane.com/desktop/try-it/) that works with X-Dispatch, so you can try both.

## Manual

- [Command-line flags](manual/cli.md) — `--reset-cache`, `--xp-arg=`, `--help`, `--version`

## Development

```bash
npm install           # install dependencies
npm start             # dev mode with hot reload
npm run start:clean   # fresh start (clears .vite cache)
npm run make          # build distributables
```

```bash
npm run typecheck     # TypeScript strict mode
npm run lint          # ESLint
npm run lint:fix      # auto-fix lint issues
npm run format        # Prettier
npm run check         # all three at once
```

Electron + React 18 + TypeScript, MapLibre GL JS, Zustand, SQLite. Node.js 20+.

## Support

- [Discord](https://discord.gg/76UYpxXWW7)
- [Issues](https://github.com/lyestarzalt/x-dispatch/issues)

## Donate

X-Dispatch is a passion project built for the X-Plane community. Donations are entirely optional but appreciated.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/A0A21V3IZZ)

## License

GPL-3.0 — see [LICENSE](LICENSE).
