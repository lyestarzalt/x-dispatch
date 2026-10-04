# Changelog

All notable changes to X-Dispatch are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Tablet access**: open X-Dispatch in the browser of a tablet or another computer on your network. Turn it on under Settings > Tablet access and scan the QR code. The desktop app keeps talking to X-Plane, and the map runs smoothly on the tablet. You can see connected devices, disconnect them, reset the pairing and change the port. Actions that need the desktop, such as file dialogs and add-on installs, are shown disabled on the tablet.
- **Vertical profile**: a strip under the map shows your planned climb, cruise and descent, top of climb and descent, procedure altitude restrictions, the terrain under the route and the safe altitude for each leg and the whole route. Hover it to see where that point is on the map. Climb and descent follow whether you fly a jet or a prop. Open it from the planner, the flight plan bar or the map button. SimBrief plans use the same chart.
- **Right-click menu** on the map: start your flight there, copy the coordinates in your chosen format, read the terrain elevation or centre the map.
- **Measure tool**: right-click > Measure from here to measure distance and course across as many points as you like. Points can be dragged or removed. Start on a VOR or NDB to read the radial.
- **Units** settings: choose units for distance, altitude, speed, vertical speed, weight and coordinates, each with a live example. They apply across the planner, SimBrief, airport info, logbook, launch screen and map.
- Courses can be shown magnetic, true or both, using the current world magnetic model. This covers ILS headings, gate headings and bearings on the map.
- The planner picks a SID, STAR and approach for you from the runways and the route, including the approach transition the STAR leads to. Your own choice is always kept.
- **New plan** button in the planner, and a clear button on each airport field. SimBrief and file plans are left alone.
- Clicking a route waypoint or navaid shows its planned altitude.
- Satellite and other image basemaps now show borders, place names, road names and points of interest, in the app language.
- Country, region and large water names on the map now follow the app language instead of staying in English. Town names keep their local spelling as before.
- The flight strip has its own size setting under Appearance, and a button that opens it in a small always-on-top window you can keep over the simulator.
- The About page shows what the updater is doing (checking, downloading, ready, failed) and has a **Check for updates** button. On Windows, a downloaded update now offers **Restart now** inside the app instead of a system dialog.
- About lists the third-party software X-Dispatch uses, with their licenses, in a searchable list.

### Changed

- SIDs, STARs and approaches are drawn much closer to the charts: DME arcs, course and radial intercepts, holds and procedure turns, and the missed approach dashed. Loops and odd detours at some airports are gone.
- The flight plan line is clearer: one colour per SID, STAR and approach, leg distance and course written on the line, procedure names on their legs, and waypoint labels that thin out as you zoom out.
- Map tiles stay sharp on displays with scaling such as 125% or 150%.
- The interface font ships with the app, so X-Dispatch no longer contacts Google Fonts at startup.
- Only the Interface Zoom setting changes the interface size now. Ctrl + and Ctrl - no longer change it.

### Fixed

- US airports such as KJFK, KORD and KSFO no longer lose runways in the flight plan builder.
- Procedures that start or end at a runway now draw from the runway itself, including the missed approach climb-out.
- Procedure speed limits and second altitude restrictions are read correctly.
- Zooming in with the mouse wheel no longer jumps the map back to an earlier view.
- Airport search results no longer open behind the planner.
- Daylight on satellite and light basemaps no longer washes the map out.
- Your aircraft, flight trail, VATSIM and IVAO pilots and X-Plane traffic stay above airport layouts such as gates and taxiways.
- Windows: a failed update check at startup is retried after ten minutes instead of waiting four hours.
- SIDs and STARs appear as soon as you select them while X-Plane is connected. They used to stay hidden until something else changed the map, such as zooming out.
- Clicking an airport always opens it while X-Plane is connected; the click could silently do nothing before.
- The ruler measurement no longer comes back after a restart, and the right-click menu offers **Clear measurement** wherever you click once one exists.
- The flight strip follows your speed, altitude and vertical speed units instead of always showing knots, feet and feet per minute.
- The flight strip can no longer end up outside the window after changing window size or interface zoom.
- Switching the app back to English restores English map labels.
- Dropping a file outside a drop zone no longer replaces the app window, and Ctrl+F no longer takes over the shortcut in other apps.

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
