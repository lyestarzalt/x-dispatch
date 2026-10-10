# Changelog

All notable changes to X-Dispatch are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.4.0] - 2026-10-10

### Added

- **North Atlantic tracks** in the flight planner. Pick a track from today's message, see its levels, fixes and remarks, and let Auto route fly it from entry to exit. The planner warns when your cruise level is not available on the track. A new map layer draws the day's tracks, and clicking one routes through it.
- **Airway checks** in the planner. If you type an airway the wrong way, or at a level it is not published for, the planner tells you under the route and shows the levels it allows. When your cruise altitude does not fit the route, or is odd where it should be even for your direction, an **Adjust** button fixes it in one click.
- **Random destination.** Choose a departure, how long you want to fly, and your aircraft class, and get five random destinations. Filter by domestic or international, custom scenery only, destination weather, or VATSIM ATC online. Find it under Explore > Routes > Random, or from the dice button in the planner.
- **Better runways on the map.** Displaced thresholds, overruns and blast pads are drawn, with the markings and lights in the right place. Water runways appear as lanes and can be used as start positions, so seaplane bases work from the Start tab and the map.
- **New Layers panel.** The long Layers list is now a compact panel that fits on a 1080p screen: airport types and surfaces as chips, nav layers as switches, overlays as tiles, and range rings with an hour picker. It stays open while you change things.
- **Open from links and files.** Links such as `xdispatch://airport/EHAM` can open an airport, a route, a SimBrief plan, the launcher or settings, even when the app is closed. `.fms` files open from Finder and Explorer with Open With. Recent airports show in the Dock menu on macOS and the taskbar jump list on Windows.
- **Application menu** on every platform with working shortcuts, including Settings, Check for Updates and Help links. Windows and Linux get a menu button in the title bar. Press Cmd+/ or Ctrl+/ to see all shortcuts. Cmd+W closes a dialog before the window, and Ctrl+W no longer quits the app.
- **Desktop window settings** under Appearance: keep X-Dispatch running when you close the window on macOS, bounce the Dock or flash the taskbar when X-Plane connects or an update is ready, and show recent airports in the Dock or jump list.
- **SimBrief username.** Enter your SimBrief username instead of hunting for the numeric Pilot ID. Both work, in Settings and in `xdispatch://simbrief` links.
- **Send to FMS** from the briefing footer. Each export target you set up is one menu entry, with "Send all" when you have several. With none set up, the menu takes you to Settings.
- The SimBrief briefing says when the plan was generated and which AIRAC cycle it uses, next to Refresh.
- A banner under the title bar tells you when you are offline.
- Planner: **Undo** after New plan or Clear, and skipped route items say why.
- Launcher: choose live weather, a preset or your own; the Real button shows a summary of today's METAR. Weight & Fuel is one card with your takeoff weight, the maximum and the margin. The launch summary sits right above the Launch button.

### Changed

- **SimBrief briefing, rebuilt.** One screen, same height whichever tab you pick: the route and the Import button at the top, then four tabs: Route, Fuel & weights, Performance, Weather & NOTAMs. Hover the vertical profile and the navlog scrolls to that fix. The navlog shows real ETAs, not elapsed time. Fuel and weights follow your unit settings, whatever units your SimBrief account uses.
- **SimBrief routes on the map** draw like planned routes: the SID, STAR, airways and oceanic tracks in their own colours, with the route starting and ending at the airports.
- The flight card on the map is a summary: route, alternate, time, cruise level, block fuel and takeoff weight, with one button to the full briefing. Collapsed, it still shows the flight number, the route and the cruise level.
- SimBrief errors tell you what to do: unknown user, no plan on file, no connection. With no SimBrief account set up, the briefing has a button straight to the SimBrief settings.
- Large airports such as Paris, Frankfurt and Atlanta load several times faster, with no visible change. The Surface detail setting is gone, since there is nothing left to choose.
- Auto route is faster, picks airways for your cruise level from the start, and the plan no longer flickers while it redraws. Before, a jet route built before the cruise altitude was set could end up on low airways capped at FL195.
- The planner shows departure and arrival in their own blocks, with a swap button between them and the aircraft class next to the figures it affects.
- The airport filter now hides every filtered airport, and favourites no longer draw twice. You cannot switch off the last airport type or runway surface.
- The country filter lists each country once. The scenery files spell the United States eight different ways.
- Taxi distance, thermals, approach and boat distances, launch history and the air-start altitude follow your unit settings. Wind stays in knots.
- Long names and translated labels no longer overflow, and every button shows a focus ring when you tab to it.
- Zoom keys change the interface size and show the percentage.
- macOS: the title bar dims when the window is inactive, follows your double-click preference, and adapts to full screen.
- The add-on installer explains why a drop cannot be installed: a folder (zip it first), a file that is not .zip, .7z or .rar, an archive with no add-on inside, or several files dropped at once.
- About credits Gilles for testing and community.

### Fixed

- Opening some SimBrief plans crashed the briefing, for example a short flight with no route legs. SimBrief plans are now read in the format SimBrief recommends, which also makes the download much smaller.
- The AIRAC cycle in the SimBrief briefing was always blank.
- The SimBrief vertical profile started at top of climb instead of the departure airport, and did not land at the arrival.
- The SimBrief navlog showed every Mach as M0.00.
- SimBrief weather showed cloud ceilings as BKN8000 instead of BKN080.
- The flight card's "Open full OFP" button opened a broken link.
- One-way airways and the split between low and high airways were read wrong from the navigation data. This affected Auto route and the airway layers on the map. The navigation data is read again once on the first launch after updating, so the first start takes a little longer.
- Clicking a VOR or NDB always shows its type, name and frequency, including waypoints of a loaded plan. NDB frequencies in built plans were shown divided by 100. Localizers can be clicked to see their runway and course.
- The launcher weight panel and the loading error screen no longer show raw translation keys.
- If a METAR refresh fails, the last report stays instead of disappearing.
- Settings can no longer lose your X-Plane installations when the folder is missing or a file is unreadable. Switching installs clears the previous install's X-Plane version.
- Quitting is faster: the navigation data is only saved when something changed.
- If the app window crashes, it reloads itself. A second crash within a minute asks whether to reload or quit.
- The landing notification shows the touchdown rate in your chosen vertical speed unit.
- The title bar keeps its size and stays clear of the window controls at any interface zoom.
- Terrain shading stays off on satellite and other image basemaps, where it only darkened the picture.

## [2.3.1] - 2026-10-04

### Added

- The flight strip window has an opacity setting under Appearance, so you can see the simulator through it.

### Changed

- The Dark and Light map themes now come from OpenFreeMap. CARTO started requiring an API key, so this keeps them free and watermark-free. If you used either theme, you are moved over automatically.
- The flight strip window has no title bar. Drag the strip to move it, drag the edges to resize it, and the strip scales to fit. Hover it to show a close button.
- The pop-out button on the flight strip also closes the strip window, and shows a close icon while it is open.

### Fixed

- The flight strip window stays above X-Plane in fullscreen, and no longer disappears when you minimize X-Dispatch.
- Sea borders along coastlines are no longer drawn on the Dark and Light maps.
- Aircraft in the launch list no longer overlap with the large font size.

## [2.3.0] - 2026-10-04

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

[unreleased]: https://github.com/lyestarzalt/x-dispatch/compare/v2.4.0...HEAD
[2.4.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.2.0...v2.2.1
