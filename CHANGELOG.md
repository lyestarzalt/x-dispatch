# Changelog

All notable changes to X-Dispatch are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Satellite and other image basemaps now show borders and place names, in the app language.
- The flight strip has its own size setting under Appearance, and a button that opens it in a small always-on-top window you can keep over the simulator.
- Country, region and large water names on the map now follow the app language instead of staying in English. Town names keep their local spelling as before.
- The About page shows what the updater is doing and has a **Check for updates** button. On Windows, a downloaded update now offers **Restart now** inside the app instead of a system dialog.

### Fixed

- Your aircraft, VATSIM and IVAO pilots and X-Plane traffic stay above airport layouts such as gates and taxiways.
- Windows: a failed update check at startup is retried after ten minutes instead of waiting four hours.
- SIDs and STARs appear as soon as you select them while X-Plane is connected. They used to stay hidden until something else changed the map, such as zooming out.
- The ruler measurement no longer comes back after a restart, and the right-click menu offers **Clear measurement** wherever you click once one exists.
- The flight strip follows your speed, altitude and vertical speed units instead of always showing knots, feet and feet per minute.
- Clicking an airport always opens it while X-Plane is connected; the click could silently do nothing before.

## [2.2.1] - 2026-10-02

### Added

- **Start Anywhere** (formerly Drop Pin): place your aircraft anywhere on the map. The start options (on the ground, in the air, on a carrier or a frigate) now open right away so you can pick how you begin.

### Changed

- Airport search now tells you when nothing matches.
- Opening a flight plan file that can't be read now shows a clear message instead of doing nothing.
- Daylight on the globe is softer on the dark map, so land and sea keep their colours.

### Fixed

- If X-Dispatch's local data gets damaged, the app now rebuilds it by itself instead of failing to start.

## Earlier releases

Releases up to 2.2.0 are listed on the [website changelog](https://x-dispatch.app/changelog/).

[unreleased]: https://github.com/lyestarzalt/x-dispatch/compare/v2.2.1...HEAD
[2.2.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.2.0...v2.2.1
