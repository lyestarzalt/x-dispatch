# Changelog

All notable changes to X-Dispatch are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **An X-Plane .fms file now opens in the flight planner.** The SID, STAR and approach the file names are loaded from your nav data and drawn in their own colours, the same as a plan built in X-Dispatch or imported from SimBrief. Files from SimBrief, Little Navmap and FlyCharts all work. A procedure your nav data does not have is pointed out under "Adjusted" so you can pick another.

### Fixed

- **The STAR no longer starts one leg early in a planned route.** The leg into the fix where the airway hands over to the STAR is drawn and labelled as the airway, as SimBrief plans already were.
- **The approach picker no longer guesses a transition.** Where every version of an approach has a transition, the planner used to take the first one before it knew your STAR, and kept it. It now waits and fills in the transition that starts where your STAR ends.

## [2.8.2] - 2026-10-17

### Changed

- **The Flight Strip reads like a cockpit display.** Live values are white, the selected autopilot values sit in magenta right above the digits they belong to, Mach reads as M .78, and the track over the ground replaces the NAV1 frequency under the heading.
- **Put the Flight Strip's readouts in your own order.** In Settings, Flight Strip, drag a readout to move it along the strip.
- **COM1 and QNH can join the Flight Strip.** Switch them on in Settings, Flight Strip: the active frequency with the standby under it, and the altimeter setting in hPa with inches of mercury under it. Both are off until you want them.

### Fixed

- **The Flight Strip no longer changes size as the numbers change.** Every value keeps room for its widest reading, so a vertical speed swinging from 0 to -1,200 or a wind picking up leaves the strip, and the popped-out window, exactly where they were.
- **The Flight Strip's taxi map follows the route you are on.** With a departure and an arrival both planned it showed only the departure, so a route planned after landing never appeared, and a route you cleared stayed drawn.
- **Taxi instructions stay readable on a narrow Flight Strip.** With only a readout or two shown, the next instruction wraps onto a second line instead of being cut off.
- **The Flight Strip's heading is magnetic**, like the heading bug above it and the track under it. It showed true heading, so where variation is large the value and the bug disagreed even with the aircraft on the selected heading.

## [2.8.1] - 2026-10-17

### Changed

- **Your aircraft symbol has a size and colour of your choosing.** In Settings, Appearance, pick small, medium or large, and white, magenta or orange. It keeps the same size at every zoom level instead of growing as you zoom in.
- **In flight, your aircraft casts a shadow on the ground** that drifts further from the symbol as you climb, and the label shows an arrow while you climb or descend. The shadow can be switched off in the same place.
- **The line ahead of your aircraft showing where you will be in a minute is gone.** The symbol and its shadow carry the picture on their own.

### Fixed

- **A taxi route can no longer be sent out and back along the same taxiway.** Dragging a point to where the route would have to taxi there and back shows it in red and leaves the route as it was, and clicking a point behind the route shortens the route to that point.
- **The ends of a taxi route are easier to move.** The dots at your stand now drag the route's start or end, and the route keeps meeting your stand while that end stays on the stand's taxiway. Grabbing near an end no longer adds a point instead, and stepping an end back along the route no longer jumps to a taxiway beside it.
- **A SimBrief route no longer skips the last fix of the SID.** The line used to cut from the fix before it straight to the first airway fix; it now flies through the SID's exit fix, as the navlog does.

## [2.8.0] - 2026-10-16

### Added

- **Edit, add and total up your logbook.** Change a flight's airports, aircraft, times and landings, add a flight by hand, and see totals at the top: flights, block and air time, distance, landings, average and best touchdown.
- **Export and import the logbook as CSV.** Export every flight to a spreadsheet, and import one back; flights already in the logbook are skipped.
- **Remove a point from your taxi route** by double-clicking it, and undo any change to the route one step at a time.

### Changed

- **Reshaping a taxi route is easier to follow.** While you drag the route, the point slides along the taxiway under your cursor and shows its name, the new route is drawn in place of the old one, and it turns red where there is no way through; letting go there keeps the route you had. Points you add stay on the route instead of being dropped when it passes them twice.
- **Taxi routes keep to taxiways wide enough for your stand's size.** A narrower taxiway is used only when there is no other way.
- **The Flight Strip's taxi map no longer pops open when you land.** It closes at takeoff and opens again only when you press the map button.
- **X-Dispatch uses less CPU while it sits behind X-Plane.** The main map stops following your aircraft while the window is hidden and catches up as soon as you bring it back.
- **X-Dispatch uses about 500 MB less memory and starts faster.** The navigation and airport data now stays on disk instead of being loaded into memory at launch.

### Fixed

- **Taxi routes to the runway stop at the holding point.** A departure route now ends where you hold short, at the entry nearest the runway end, instead of running onto the runway or back down it. Routes no longer double back on themselves or take an exit the wrong way, and they cross runways only when there is no way around. An arrival route starts at the exit you can make after your rollout, not at the far end of the runway. Fields without a parallel taxiway still get a route that backtracks the runway.
- **Taxi routes start and end right at your stand.** The route used to begin at the next junction along the taxiway, sometimes a few hundred metres away.
- **The taxi route distance is right again.** A route that crossed or used a runway showed a much longer distance than you would taxi.
- **A locked Flight Strip can be unlocked again on Windows.** With display scaling above 100%, the lock button sat where clicks no longer reached it, so the strip stayed locked.
- **The satellite basemap no longer starts with terrain shading on it.** With shading switched on for another basemap, the imagery came up darkened by hillshade and contour lines until the switch was toggled.

## [2.7.0] - 2026-10-16

### Added

- **A taxi map in the Flight Strip.** Press the map button and a heading-up view of the airport opens under the strip, with your taxi route, taxiway and runway labels and your aircraft on it. It follows you as you taxi, and tells you when no route is planned yet. Without X-Plane it previews the route from its start. It works in the popped-out strip too.
- **Load a VATSIM or IVAO pilot's flight plan.** Open a pilot's card and press the plan button to hand their filed route to the planner. Speed and level notes are dropped, a filed SID or STAR goes into the procedure picker, and one line tells you what was changed.
- **The Flight Strip hides while X-Plane is away** and comes back when it reconnects, without taking focus. A strip you opened yourself before X-Plane was running stays up.

### Changed

- **A new symbol for your aircraft on the map.** One clear airplane, or helicopter, in the app's colours. It stays the same size whether you look at the whole globe or the terminal area, grows a little on the taxi map, and a line from the nose shows where you will be in one minute at your current speed. The blurry silhouette, the glow, the shadow and the blinking lights are gone.
- **Online ATC shows on the airport itself.** A staffed airport gets a ring on its dot and a letter for each position next to its name. Hover for the summary, click for every position with its frequency and ATIS.
- **VATSIM and IVAO share the same pilot and ATC cards.** The separate IVAO popup, trails and badges are gone.
- **The Flight Strip window buttons sit inside the strip,** always visible and sized with it.

### Fixed

- **Starting on a runway with a one-digit name, such as 8L, works again.** X-Plane only accepts two-digit names, so the launcher now sends 08L. About 3,600 runway ends were affected.
- **The taxi planner follows an imported flight plan's runways.** It used to look at the plan only when you picked a gate. A route you drew yourself is never replaced.
- **The SimBrief Performance tab no longer crashes** on plans without runway analysis; it says the takeoff and landing report is not available.
- **A locked Flight Strip takes the first click** on its buttons on Windows.
- **The Windows installer has its icon back.**

## [2.6.0] - 2026-10-14

### Added

- **Taxi guidance in the Flight Strip.** On the ground, the strip shows your next turn and how far away it is, the taxiway you're on, runway crossings and where to hold short, with an arrow pointing the way. The taxi planner suggests a route to your SimBrief runway, and the map draws it up to the hold line and trims it as you taxi. It works in the popped-out Flight Strip too.
- **Beta updates.** When a beta is available, switch on Beta updates in Settings > About to get each beta as it comes out. When the full release catches up, you move to it automatically and the switch turns off. Switch it off at any time to go back to the latest full release.

### Changed

- **X-Dispatch now updates itself on Windows, macOS and Linux.** Updates download in the background and install when you restart or quit, and after this one they only download what changed, so they are much smaller. On Windows this update moves you over on its own. On macOS and Linux, download this version once from the website; from then on it updates itself. On macOS you still confirm Open Anyway the first time you open it.
- **A tidier About page.** Update status, the update button and the beta switch sit together under Updates.
- **Aircraft with the same name are easy to tell apart.** The list shows what differs between them, such as their folder or file name, the flight setup shows the aircraft's file, and search finds aircraft by their path.

### Fixed

- **Clicks on the map keep working after switching X-Plane installation.** Gates, runways, the right-click menu, pins and the measure tool stopped responding until X-Dispatch was restarted.
- **Double-clicking the Flight Strip padlock no longer locks it again,** and unlocking no longer puts the close button under your cursor.

## [2.5.0] - 2026-10-12

### Added

- **Lock the Flight Strip window so clicks pass through to X-Plane.** Use the padlock in the strip's corner, Settings, View > Lock Flight Strip, or Ctrl+Shift+K (Cmd+Shift+K on macOS). Click the padlock again to unlock it. On Linux the padlock stays hidden while locked, so unlock from the menu or the shortcut.
- **A Flight Strip tab in Settings.** Lock the window, keep it on top, open it automatically when X-Plane connects, and choose its size, opacity and which readouts it shows.

### Changed

- **One Flight Strip at a time.** Popping the strip out hides it on the map, and closing the window brings it back.
- **The Flight Strip window keeps the strip's shape** when you resize it, and can no longer be maximized.
- **Flight Strip size and opacity moved** from Appearance to the new Flight Strip tab.
- **Clearer VATSIM pilot and ATC cards.** Click a pilot to see where they are flying, their altitude, speed and full route, in your units and language. Click an airport's ATC badges to see every position with its frequency and ATIS. Both stay up to date while open.

### Fixed

- **Launching at a gate whose name has extra spaces no longer stops at X-Plane's main menu.** Gate names are now sent exactly as the scenery writes them.
- **Tablets show the same flight plan as the desktop.** Each device used to keep its own copy, so a tablet opened the plan it last had. Edits on any device now reach all of them, and the latest edit wins.
- **The update notice's Download and Later buttons work while a dialog is open.**
- **X-Dispatch starts again after quitting with the Flight Strip window open.** Closing X-Dispatch now closes the strip window too.
- **VATSIM controller sectors no longer go missing.** The sector overlay could stay empty or out of date.
- **Every staffed ATC position at an airport shows on the map.** Delivery, Ground, Tower and Approach badges were stacked on top of each other, so only one was visible.

## [2.4.3] - 2026-10-11

### Fixed

- **Gates and runway ends could not be clicked on the first launch after installing.** The map waited for a ready signal that never came when a basemap tile failed to download, so clicking a start position did nothing until a relaunch. The map engine is updated to 6.14, which carries the fix.
- **A refused Change Flight no longer looks like a success.** When X-Plane rejects the flight it is sent while running, the launch dialog now stays open and shows X-Plane's own reason, such as an unknown ramp or a missing aircraft file, instead of closing as if the flight had started.
- **Startup no longer fails when Windows is still holding the old database.** After an update that changes the database layout, a virus scanner or the previous instance could keep the old file open for a moment, and X-Dispatch quit with a "Failed to initialize the database" error. It now starts with a fresh database and overwrites the old file once it is released.
- **A tablet that opened X-Dispatch before an update no longer gets stuck on "could not load".** The page reloads itself once when a part of the app fails to download, which is what happens when the desktop was updated while the tablet still had the old page.
- **A clear message when the map has no graphics acceleration.** Instead of a technical WebGL error, the map panel now says what usually causes it, a Remote Desktop session, hardware acceleration turned off, or a graphics driver that failed to start, and what to try.

### Changed

- **Smoother map tiles.** Tiles fade in instead of popping, parsed tiles are kept for more zoom levels so panning back or zooming out and in no longer reloads them, and zooming in shows coarser tiles while the sharper ones arrive.
- **Sharper map on large high-DPI windows.** The map canvas is no longer capped at 4096 pixels per side, which silently reduced the resolution on 4K and scaled displays.

### Removed

- **The on-disk map tile cache.** Tiles now use the system HTTP cache, which follows each provider's own caching rules. The old `tile-cache` folder in the app data directory is no longer used and can be deleted to free up to 500 MB.

## [2.4.2] - 2026-10-11

### Added

- **Readable labels over imagery.** On satellite and other image basemaps, place names are white with a dark halo, countries and states in bold, water in light blue. A new Map labels block under Graphics, shown for image basemaps only, lets you hide label categories and set their brightness and size, applied live.

### Fixed

- **Upper airways and holds were missing.** Airway segments published up to FL660 and holds with no ceiling were dropped when the database was built, so typed routes on European upper airways such as `PINAR N870 PONEN T600 CASPE` failed with "airway does not connect the points". The airways database rebuilds on first start.
- **A start that goes wrong is no longer a black window.** If X-Dispatch cannot load, or an error takes the whole window down, you now see what happened with Reload and Open log file buttons and the log path. A window that stops responding asks whether to reload it, keep waiting or quit. On a tablet, a browser that cannot reach the computer shows the app with a reconnecting notice after a few seconds instead of a blank page.

## [2.4.1] - 2026-10-10

### Added

- **Last published track set.** Outside track hours the planner keeps the last North Atlantic set on offer, marked "Last published", so you can still plan a crossing in the morning before the day's eastbound set is out. Hover the label to see when the next set is usually published. The set is remembered between launches.

### Changed

- **Explore lives in the planner.** The Explore pane on the map is gone. Open the planner and use the Random, Routes and Weather buttons in its header: a route fills both airports, a random or weather pick becomes the arrival. The toolbar Explore button opens the planner on Routes. The Featured airports and VATSIM events tabs are removed; the VATSIM map layer stays.
- **Swap** starts the return leg over: a new route, cruise level, alternate and procedures, routed in one go. Before, it reversed the old route and kept the old level, so one-way airways ran the wrong way and the alternate belonged to the other airport.
- **Cruise level picked for you** now lands on a level the tracks offer and inside what your route allows, odd or even for your direction. Picking a track moves the cruise onto that track's levels. Changing the level on a plan Auto route built routes it again for the new level.
- **Clearer level warnings.** The banner names the airway behind a limit, for example "L10 stops at FL250". When two airways never share a level it says so and points you to Remove instead of an Adjust button that cannot help. Shorter, plainer wording throughout the planner.
- Auto route is the blue button, so the main action stands out.

### Fixed

- Auto route could mix a low airway into a high-level plan, leaving no level that fit the whole route and an Adjust button that flipped between "above the ceiling" and "below the floor". The router now only uses airways published at your cruise level.
- Flights across the Pacific: fixes beyond the dateline were reported as not in the database, the route drew a giant loop around the globe, Show on map framed the wrong side of the world, and the North Atlantic tracks panel appeared.
- Polar routes such as London to Tokyo or New York to Hong Kong found no route.
- Routes over France at high levels found no route, since France has removed most of its upper airways. Auto route now flies direct between en-route fixes there, as the real airspace works.
- Atlantic crossings could find no route at all while both track sets were published.

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

[unreleased]: https://github.com/lyestarzalt/x-dispatch/compare/v2.8.2...HEAD
[2.8.2]: https://github.com/lyestarzalt/x-dispatch/compare/v2.8.1...v2.8.2
[2.8.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.4.3...v2.5.0
[2.4.3]: https://github.com/lyestarzalt/x-dispatch/compare/v2.4.2...v2.4.3
[2.4.2]: https://github.com/lyestarzalt/x-dispatch/compare/v2.4.1...v2.4.2
[2.4.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/lyestarzalt/x-dispatch/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/lyestarzalt/x-dispatch/compare/v2.2.0...v2.2.1
