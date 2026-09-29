# Changelog

All notable changes to this project will be documented in this file.
## v2.2.0 - 2026-09-29

### Features

- **ui:** NAV1 frequency after CRS in the flight strip by @lyestarzalt(7e70767)
- **map:** Navaid station elevation in the nav info popup by @lyestarzalt(4c3b492)
- **plan:** Daylight planner in the flight plan builder by @lyestarzalt(a61f0bc)
- **ui:** Label custom nav data sources and flag expired AIRAC cycles in settings by @lyestarzalt(94ab274)
- **launcher:** Show add-on aircraft version in the aircraft list by @lyestarzalt(01dbe81)
- **launcher:** Read per-model version files like version-777.txt by @lyestarzalt(20c103c)
- **map:** Satellite cloud overlay from NASA GIBS infrared imagery by @lyestarzalt(9109f33)
- **map:** Satellite clouds off the main thread, Meteosat coverage for Europe by @lyestarzalt(003e5f8)
- **map:** Fade satellite clouds out by z10 to keep airport view clear by @lyestarzalt(4a0e660)
- **navdata:** Name the data provider from the nav header, with a subtle logo in settings by @lyestarzalt(2e172be)
- **release:** Publish releases and app updates through dl.x-dispatch.app by @lyestarzalt(b9f1e21)
- **update:** Read updates only from dl.x-dispatch.app and check public downloads from CI by @lyestarzalt(adf11a5)
- **analytics:** Opt-in anonymous usage analytics with PostHog by @lyestarzalt(1a7f58d)
- **analytics:** Send country from the OS region setting by @lyestarzalt(0314fa0)
- **analytics:** Track launches, airports, layers, settings and tools by @lyestarzalt(2b356b3)

### Bug Fixes

- **map:** Keep the camera still when selecting a SID, STAR or approach by @lyestarzalt(98b0ab7)
- **map:** Keep the camera still when editing the same flight plan by @lyestarzalt(6cf3e08)
- **ui:** Plan builder save status on its own row above Save to X-Plane by @lyestarzalt(a5240d8)
- **navdata:** Detect custom nav data and compute AIRAC validity from the cycle number by @lyestarzalt(e9320c7)
- **navdata:** Validate nav cache against resolved source files on startup by @lyestarzalt(e9b52e6)
- **build:** Migrate Vite configs to ESM and drop deprecated rolldown options by @lyestarzalt(3148087)
- **map:** Draw SID and STAR lines from their published legs by @lyestarzalt(14a02b6)
- **release:** Pass --only-show-errors to aws s3 cp only by @lyestarzalt(dbdd630)
- **release:** Skip generated files when describing R2 release assets by @lyestarzalt(bc9e73d)
- **updater:** Check for Windows updates every 4 hours by @lyestarzalt(b6d4466)
- **analytics:** Never delay quit; redesign consent dialog by @lyestarzalt(d83e417)

### Refactor

- **simbrief:** Rewrite FMS export filename helper by @lyestarzalt(48e8d2e)

### Documentation

- Update CHANGELOG.md for v2.1.0 by @github-actions[bot](5f0875f)
- Flight plan builder section and ground weather video in the README by @lyestarzalt(4056ab6)
- Shorter flight plan builder caption by @lyestarzalt(29c3aaa)
- Planner and ground weather in screenshots, one-liner bullets by @lyestarzalt(d31a1dd)

### Miscellaneous

- Update license and support links by @lyestarzalt(474b031)
- **i18n:** Shorten the About project notice by @lyestarzalt(7e2e3a5)

### CI/CD

- **release:** Keep commit and PR links in a collapsed section of the release notes by @lyestarzalt(6b8abb7)
- **release:** Demote headings inside the collapsed commit list by @lyestarzalt(f8489f5)
- Release preflight workflow and actionlint in CI by @lyestarzalt(3bdb8dc)
- Actionlint config for valid runner labels, shellcheck at warning severity by @lyestarzalt(31f78dd)
- **release:** Keep GitHub releases as notes-only drafts by @lyestarzalt(8ff914b)
- **release:** Optionally publish a GitHub release for pre-2.2 updaters by @lyestarzalt(3ab5939)
- **release:** Optionally publish the Windows update feed on GitHub for pre-2.2 installs by @lyestarzalt(883a69d)

### Release

- 2.2.0 by @github-actions[bot](1e75aa3)


## v2.1.0 - 2026-09-27

### Features

- **ui:** Motion-driven dialog and landing card animations by @lyestarzalt(30e6ddc)
- **ui:** Tab crossfade, sliding nav indicator, search dropdown entrance by @lyestarzalt(eff8cfd)
- **ui:** Batch 3 micro-animations by @lyestarzalt(146194a)
- **ux:** Native desktop feel pass by @lyestarzalt(8253e7d)
- **ui:** Readable flight strip, landing notification setting by @lyestarzalt(acc1d64)
- **ui:** Minimal attitude indicator in the flight strip by @lyestarzalt(c453ad3)
- **map:** Range rings polish by @lyestarzalt(c7768b2)

### Performance

- **data:** Coalesce database saves and query counts with SQL count() by @lyestarzalt(c77a87d)
- **main:** Async filesystem work in scenery, installer, launcher and images by @lyestarzalt(11b329b)
- **map:** Skip redundant layer moves, uploads and per-frame store writes by @lyestarzalt(7b156ca)
- **data:** Debounce database saves so a load session lands one write by @lyestarzalt(782e3f3)
- **data:** Yield between bulk insert chunks to keep main process responsive by @lyestarzalt(7dcd023)
- **main,map:** Async addon scans, bbox airport lookup, memoized ATC badges by @lyestarzalt(f36e666)
- **ui:** Virtualize launcher aircraft list, memoize scenery rows by @lyestarzalt(59848f9)

### Documentation

- Update CHANGELOG.md for v2.0.1 by @github-actions[bot](182bd99)

### Release

- 2.1.0 by @github-actions[bot](955a925)

### Test

- Await async bulk inserts by @lyestarzalt(6fd9b1f)
- Landing notification default in settings migration by @lyestarzalt(ae28b1c)


## v2.0.1 - 2026-09-26

### Bug Fixes

- **addons:** Installing scenery no longer edits scenery_packs.ini; ask the user to start X-Plane once by @lyestarzalt(87b5b07)
- **addons:** Stop writing the Skunkcrafts updater disabled flag when toggling add-ons by @lyestarzalt(9da72eb)
- **addons:** Keep a disabled global airports entry disabled; write the Linux launch file next to the sim by @lyestarzalt(14345f4)
- **launch:** Use the sim's Output folder on Linux only when it exists, no folder creation by @lyestarzalt(c5bf9cc)

### Documentation

- Update CHANGELOG.md for v2.0.0 by @lyestarzalt(f8eff51)

### Miscellaneous

- **launch:** Drop the unused Freeflight.prf writer by @lyestarzalt(c1cc468)

### CI/CD

- Dispatchable Discord release announcement by @lyestarzalt(f8e00bc)
- Release pushes through the X-Dispatch app token and checks push access before building by @lyestarzalt(0597e9e)

### Release

- 2.0.1 by @github-actions[bot](2be94c0)


## v2.0.0 - 2026-09-26

### Features

- **simbrief:** Let a format pin the filename an addon requires by @marcellogentile in #128(3e94191)
- **map:** Add ground routing network debug layer by @lyestarzalt in #135(76a1a45)
- **map:** Light the globe from the sun and add night city lights (#143) by @lyestarzalt(020e4b6)
- Flight recorder with trail, landing report, replay and logbook (#145) by @lyestarzalt(d4d805b)
- **map:** Stands with identity by @lyestarzalt(b3e0216)
- **map:** Ground weather from METAR on the overlay canvas by @lyestarzalt(927d23e)
- **map:** Tune ground weather effects and expose the toggle in layers by @lyestarzalt(8ce969f)
- **map:** Airfield lighting scene from apt.dat light codes by @lyestarzalt(ffb7b2f)
- **map:** Drop amber hold bar fixtures and keep approach lights as plain points by @lyestarzalt(322e65b)
- **map:** Drop lead-on lights and light the airfield by default by @lyestarzalt(c317649)
- **map:** Airfield lights checkbox in the layers overlays menu by @lyestarzalt(fe1b57a)
- **explore:** Add a live weather tab by @lyestarzalt(37370fd)
- **traffic:** Stream X-Plane TCAS targets and show them as a Sim Traffic layer by @lyestarzalt(2e01208)
- **traffic:** Glide markers between snapshots by @lyestarzalt(239cc29)
- **map:** Own aircraft as a true-size silhouette with shadow, label and lights by @lyestarzalt(a91760b)
- **map:** Keep the own aircraft readable when zoomed out by @lyestarzalt(e65b907)
- **flightplan:** Plan builder MVP by @lyestarzalt(1f30ee4)
- **flightplan:** Auto route, apt.dat runways, procedures, smooth turns, redesigned builder by @lyestarzalt(1a76bfd)
- **flightplan:** Alpha tag, cleaner builder, runway-anchored route line, shared airway names by @lyestarzalt(7e22d25)
- **flightplan:** Fly the departure like a real one, roll, climb, tangent turn onto the first fix by @lyestarzalt(49322d0)
- **flightplan:** Chart symbols, published altitude constraints and SID turn direction on the map by @lyestarzalt(c4f36e4)
- **flightplan:** Docked live planner panel, spec-correct FMS export, wind runway hint by @lyestarzalt(3e7c3e7)
- **flightplan:** Level bands, procedure joins, terminal and airspace rules, FRA direct legs, alternate and fuel by @lyestarzalt(fb266bc)
- **addons:** Switch to move scenery packs across priority tiers by @lyestarzalt(4379700)
- **airport:** Filter procedures to the start runway, shadcn input for cruise altitude by @lyestarzalt(6031797)
- **flightplan:** Aircraft class selector in the planner header by @lyestarzalt(577202f)
- **flightplan:** Route again when the aircraft class changes by @lyestarzalt(f11d36e)
- **map:** Zoom-scaled navaid and waypoint labels by @lyestarzalt(8eba493)
- **map:** Navaid and waypoint info card with bearing and distance from the aircraft by @lyestarzalt(d7154a7)
- **flightstrip:** Autopilot targets and NAV1 course by @lyestarzalt(530bc9d)
- **toolbar:** Clock widget with Zulu/local and sim/system source by @lyestarzalt(c7d7b01)
- **flightplan:** Oceanic routing with NAT tracks, antimeridian wrap and direct-leg simplification by @lyestarzalt(0f507e4)
- **map:** Solid flight pictogram for stand markers by @lyestarzalt(5d52568)
- **launcher:** Conditions card and loading gauge in the flight setup panel by @lyestarzalt(e5cc609)
- **launcher:** Show the add-on studio in the aircraft list by @lyestarzalt(b4c38b5)

### Bug Fixes

- **log:** Parse Windows CRLF Log.txt correctly by @lyestarzalt(a39ead0)
- **scripts:** Make the drizzle migration check work on Windows by @lyestarzalt(a358898)
- **sentry:** Ignore transient QUIC network errors by @lyestarzalt(1e79995)
- **sentry:** Fingerprint process-gone events by what actually died by @lyestarzalt in #130(235180b)
- **sentry:** Drop disk-full reports in beforeSend by @lyestarzalt in #131(10b68ac)
- **launcher:** Classify launch failures instead of leaking raw errnos by @lyestarzalt in #133(f7ee32d)
- **tile-cache:** Write the manifest atomically and retry on file locks by @lyestarzalt in #132(617b0c0)
- **simbrief:** Keep the file extension on FMS links with a --TAG suffix by @marcellogentile(7c0e00b)
- **companion-apps:** Explain why .bat and .cmd cannot be launched by @lyestarzalt in #134(7ffff96)
- **map:** Clear mapRef on teardown so dead-map guards actually fire by @lyestarzalt(6492c4f)
- **map:** Disable day/night layer until nightlayer supports maplibre v6 by @lyestarzalt in #137(0bed477)
- **dialogs:** Seed defaultPath for file pickers (#139) by @lyestarzalt in #139(3590288)
- **main:** Restore DevTools access in dev builds by @lyestarzalt(dc107df)
- **ui:** Keep the title bar visible above full-screen dialogs by @lyestarzalt(c84aa6d)
- **map:** Restyle the landing card as a strip in the flight strip's design by @lyestarzalt(adfbafb)
- **flights:** Keep flights across stream restarts, movable landing card, clipboard image copy by @lyestarzalt(27511f2)
- **ui:** Show alert dialogs above full-screen dialogs by @lyestarzalt(504e6cf)
- **map:** Load the maplibre worker in packaged builds by @lyestarzalt(01b4c7a)
- **map:** Keep zoom at the top of the fixture radius expression by @lyestarzalt(a52eb64)
- **xplane:** Reconnect within seconds and re-resolve dataref ids after a restart by @lyestarzalt(d9a5898)
- **map:** Blank ground weather while the camera moves by @lyestarzalt(850b1f4)
- **map:** Draw snow and fog on a clean canvas by @lyestarzalt(3f8f390)
- **map:** Remove ground-weather overlays when disabled by @lyestarzalt(4fdb458)
- **launcher:** Use explicit speed for custom air starts by @lyestarzalt(ea61e39)
- **launcher:** Count flight dates from January 1 as day zero by @lyestarzalt(384ad25)
- **launcher:** Reject invalid flight payloads before sending to X-Plane by @lyestarzalt(58b19fd)
- **launcher:** Check X-Plane's flight result before reporting success by @lyestarzalt(dcaead3)
- Migrate Tailwind PostCSS setup by @lyestarzalt(4de1fff)
- Preserve MapLibre container height by @lyestarzalt(c4b3ad2)
- Migrate solar calculations to SunCalc 2 by @lyestarzalt(1780b68)
- Stabilize parsed ATIS runways by @lyestarzalt(1d68628)
- Keep tooltips clear of the title bar by @lyestarzalt(fe6bc54)
- **flightplan:** Put fly-by arc centre on the right side of the corner by @lyestarzalt(2331351)
- **addons:** Drop the alpha badge and add discard for a pending scenery order by @lyestarzalt(81e5a1d)
- **flightplan:** Draw procedure legs by type, keep procedure fixes out of NUMENR, always write CYCLE by @lyestarzalt(4994c5b)
- **procedures:** Keep the runway of single-runway SIDs and STARs, read leg course and distance from the right columns by @lyestarzalt(02ac709)
- **procedures:** Read CIFP route types per ARINC 424 and emit one variant per runway and transition by @lyestarzalt(3fde314)
- **map:** Register navaid click handling on every map instance by @lyestarzalt(5bbe452)
- **flight-strip:** Declutter tracking strip layout by @lyestarzalt(96d7ea1)
- **map:** Stop labelling a fix twice when a procedure overlaps the flight plan by @lyestarzalt(3b81c06)
- **flightplan:** Resolve long airways and NAT tracks fix by fix, scale ident lookup by latitude by @lyestarzalt(1d4d6ef)
- **tracker:** Ride out X-Plane stalls without dropping the link by @lyestarzalt(d8816f2)

### Performance

- **map:** Stop idle repaints and per-frame UI re-renders (#140) by @lyestarzalt in #140(fe351f5)
- **airport:** Draw taxiways from the pavement source and fix pavement rings (#142) by @lyestarzalt in #142(4db96b3)
- **map:** Draw airfield fixtures as circle pairs and wake strobes only on flash edges by @lyestarzalt(822eb19)
- **map:** Approach light rabbit paints only on change with sprite glows by @lyestarzalt(83a0232)

### Documentation

- Update CHANGELOG.md for v1.9.2 by @github-actions[bot](3238d81)
- Remove duplicate v1.9.2 changelog header by @lyestarzalt(f78c83c)
- **readme:** Add flight recording, landing detection, and night city lights features by @lyestarzalt(00dd898)

### Styling

- Apply updated Prettier formatting by @lyestarzalt(7e35b52)

### Miscellaneous

- **test:** Stub platform in the isElevated cache tests by @lyestarzalt(e9c23e0)
- Normalize line endings to LF via .gitattributes by @lyestarzalt in #129(12df726)
- **deps:** Upgrade maplibre-gl to v6.10.0 by @lyestarzalt(84566e8)
- **deps:** Dependency refresh and Electron 44 (#138) by @lyestarzalt in #138(c38d1d8)
- **deps:** Upgrade vite to v8 (#141) by @lyestarzalt in #141(8df8592)
- Update dependencies by @lyestarzalt(1ccdf72)
- Forward renderer console logs by @lyestarzalt(2449437)
- Migrate Vitest config to ESM by @lyestarzalt(f0f522c)
- Enforce formatting in pre-commit hook by @lyestarzalt(54e8359)

### CI/CD

- Gate version commit on successful builds by @lyestarzalt(414ac0b)
- Remove one-off v1.9.2 re-release workflow by @lyestarzalt(1d4f74a)
- Pin windows runner to windows-2022 for rc and rebuild by @lyestarzalt(e4e8177)
- Add throwaway windows build smoke test by @lyestarzalt(3e0936d)
- Remove throwaway windows build smoke test by @lyestarzalt(42395d2)
- Fix rc release download links by @lyestarzalt(597900e)
- Mint the website sync token from a github app by @lyestarzalt(f66bcb4)
- Drop narrating comment from the sync token step by @lyestarzalt(73e2144)

### Release

- 2.0.0 by @github-actions[bot](dc20036)

### Test

- **flightplan:** Give the resolver draft a cruise altitude by @lyestarzalt(2b997e0)



### New Contributors

- @marcellogentile made their first contribution in #128
## v1.9.2 - 2026-06-23

### Bug Fixes

- **settings:** Point About section website link to x-dispatch.app by @lyestarzalt(d5d7bc0)
- **sentry:** Ignore transient Electron net errors by @lyestarzalt(dc57703)

### Documentation

- Update CHANGELOG.md for v1.9.1 by @github-actions[bot](976d355)
- Point README links to x-dispatch.app by @lyestarzalt(3838cb3)
- Trim README and add requirements line by @lyestarzalt(c329304)

### CI/CD

- Add one-off workflow to rebuild missing release assets by @lyestarzalt(7fb4b67)
- Pin Node to 22 across all workflows by @lyestarzalt(0772427)

### Release

- 1.9.2 by @github-actions[bot](0fe794d)


## v1.9.1 - 2026-05-27

### Features

- Notify mac/linux users of new releases by @lyestarzalt(8350e3f)
- **debug:** Expose MapLibre debug flags in Perf panel by @lyestarzalt(ba59cc0)
- **logbook:** Copy flight JSON to clipboard for bug reports by @lyestarzalt(6d7eec9)

### Bug Fixes

- **ci:** Only treat stable tags as changelog boundaries by @lyestarzalt(4968bfc)
- **map:** Guard map ops against destroyed lifecycles by @lyestarzalt(d7a97d5)
- **main:** Guard window/db ops during boot and teardown by @lyestarzalt(a64ed94)

### Refactor

- **map:** Drop taxiway lights layer by @lyestarzalt(d984415)

### Documentation

- Update CHANGELOG.md for v1.9.0 by @github-actions[bot](e31cedc)
- Backfill v1.9.0 changelog with rc.3 content by @lyestarzalt(efb3992)
- Refresh screenshots by @lyestarzalt(102f642)
- Replace stale track-plane.png with refreshed flight-tracking.png by @lyestarzalt(e4ccfb2)
- Add 3D terrain alt view and companion app screenshots by @lyestarzalt(2804f7e)

### Miscellaneous

- Point homepage URL at x-dispatch.app by @lyestarzalt(6dff15a)
- **i18n:** Improve wording and consistency across all locales by @lyestarzalt(b38f105)

### Release

- 1.9.1 by @github-actions[bot](5ab286a)

### Tweak

- **map:** Airport feature layers pop earlier when zooming in by @lyestarzalt(329c5d4)
- **map:** Walk back airport zoom tiers by 1 by @lyestarzalt(9547e95)


## v1.9.0 - 2026-05-21

### Features

- **airport-info:** Tune airport frequencies to COM1/COM2 via X-Plane REST by @lyestarzalt(34455e2)
- **airports:** Favorite airports, home airport, auto-nav on startup by @lyestarzalt(21aef01)
- **map:** Star + home markers for favourite airports, fade on select by @lyestarzalt(6a1968f)
- **map:** Add 3D ILS glide slope rendering by @lyestarzalt(7b0fc60)
- **map:** Close ILS glide slope wedge volume by @lyestarzalt(dbca49b)

### Bug Fixes

- **ui:** Portal tooltips so they escape overflow-hidden containers by @lyestarzalt(b35731a)
- **airport-info:** Preserve multi-word apt.dat metadata and show full location by @lyestarzalt(2e5eee3)
- **electron:** Keep dev menu in development by @lyestarzalt(4286b9a)

### Documentation

- Update CHANGELOG.md for v1.8.3 by @github-actions[bot](461cbf7)

### CI/CD

- Publish release candidates as prereleases by @lyestarzalt(509d72c)
- Sync website stable catalog on release by @lyestarzalt(6118e5d)

### Release

- 1.9.0 by @github-actions[bot](e5363e3)


## v1.8.3 - 2026-05-16

### Features

- **simbrief:** Reopen full briefing dialog from the compact panel by @lyestarzalt(f9eda1d)
- **settings/primitives:** Extract reusable section primitives by @lyestarzalt(0b7f839)
- **settings/about:** Bring back the support-this-project link by @lyestarzalt(9a33425)
- **debug-overlay:** Collapsible JSON tree in state panel; resize sticks by @lyestarzalt(bd1d7e1)
- Improve startup loading progress by @lyestarzalt(e1d1b14)

### Bug Fixes

- **vatsim,ivao:** Tear down pilot layer + deferred styledata callback on disable by @lyestarzalt(f0040b2)
- **settings/nav-data:** Drop violet accent on Custom Airports tile by @lyestarzalt(c884616)
- **settings/primitives:** A11y polish before migrations consume them by @lyestarzalt(5fc5f3f)
- **i18n:** Clean up locale wording by @lyestarzalt(2122eae)
- Log main process failures by @lyestarzalt(f71cdc7)

### Refactor

- **settings:** Flat-design pass on every dialog section by @lyestarzalt(74ebd6c)
- **settings/about:** Consume primitives instead of inline shapes by @lyestarzalt(65259b1)
- **settings/companion-apps:** Consume primitives, unify empty state by @lyestarzalt(b4163cb)
- **settings/simbrief:** Consume primitives, unify FMS empty state by @lyestarzalt(c6e3810)
- **settings/logs:** Consume primitives, unify all three empty states by @lyestarzalt(0c0bddc)
- **settings/nav-data,x-plane:** Consume primitives by @lyestarzalt(08c038c)
- **settings/nav-data:** Drop category accent colours by @lyestarzalt(3439c14)
- **settings/companion-apps:** Use muted mono for exePath, not info by @lyestarzalt(1901d11)
- **settings/nav-data:** Drop "Current" badge, keep "Expired" only by @lyestarzalt(3e8c9e2)
- **settings/nav-data:** Drop status badge entirely from data source row by @lyestarzalt(0635a7a)
- **settings:** Drop inter-block separators, rely on space-y-6 by @lyestarzalt(4418828)

### Documentation

- Update CHANGELOG.md for v1.8.2 by @github-actions[bot](259dfd7)
- Update CI badge by @lyestarzalt(7c3606e)

### Miscellaneous

- Align GPL-3.0-only messaging by @lyestarzalt(f39ed26)
- **lint:** Enforce no-console, route stray console.warn through logger by @lyestarzalt(a9bbb04)
- **scripts:** Include test:run in npm run check by @lyestarzalt(a432444)
- **deps:** Bump in-range patches and minors by @lyestarzalt(63171de)
- **deps:** Bump safe major devDeps by @lyestarzalt(1c51b83)
- **deps:** Bump eslint 9 -> 10, eslint-plugin-react-hooks 5 -> 7 by @lyestarzalt(dc4055b)
- **deps:** Bump @vitejs/plugin-react 4 -> 5 by @lyestarzalt(ad25c23)
- **deps:** Bump electron 40 -> 42 by @lyestarzalt(76e3132)
- **deps:** Bump lucide-react 0.474 -> 1.16 by @lyestarzalt(8d024c4)
- **deps:** Bump three, eslint plugins, @types/*, and dev tools by @lyestarzalt(bc8d6b8)
- **deps:** Bump vite 6 -> 7 by @lyestarzalt(0e8b5f6)
- **ci:** Split dependabot into minors-batch + per-major PRs by @lyestarzalt(a2d069c)
- **ci:** Annotate dependabot ignores with pin reasons by @lyestarzalt(e616ccf)

### CI/CD

- Streamline project checks by @lyestarzalt(2daa347)

### Release

- 1.8.3 by @github-actions[bot](58a00f7)

### I18n

- Polish pirate locale by @lyestarzalt(2e6132e)
- Enforce no-literal-string lint and translate 10 locales by @lyestarzalt(7518da1)


## v1.8.2 - 2026-05-11

### Bug Fixes

- **launch:** Surface X-Plane spawn errors (EACCES, ENOENT) in the dialog by @lyestarzalt(5554a4b)
- **map:** Unify GeoJSON source adds to close addSource race (X-DISPATCH-S) by @lyestarzalt(b19a7b5)
- **taxi-route:** Always render the green path on top of airport markings by @lyestarzalt(c1ee3d8)
- **taxi-route:** Lift route layers on every data change, not just at mount by @lyestarzalt(d948408)

### Documentation

- Update CHANGELOG.md for v1.8.1 by @github-actions[bot](f0761d6)

### Release

- 1.8.2 by @github-actions[bot](581a3ff)


## v1.8.1 - 2026-05-11

### Features

- **logger:** Forward caught main-process errors to Sentry by @lyestarzalt(5724205)

### Bug Fixes

- **apt-loader:** Dedup Custom Scenery .lnk targets to avoid UNIQUE constraint crash by @lyestarzalt(e9d12dd)

### Documentation

- Update CHANGELOG.md for v1.8.0 by @github-actions[bot](e0dcba6)

### Release

- 1.8.1 by @github-actions[bot](17f9a6e)


## v1.8.0 - 2026-05-10

### Features

- **window:** Custom title bar with native overlay on Windows/Linux(6b1e5f0)
- **cli:** Add CLI flag parser and forward args to X-Plane by @lyestarzalt(5c3ea4c)
- **map-style:** User-extensible map style picker by @lyestarzalt(991f77c)
- **taxi-route:** Arrival mode (runway → gate) by @lyestarzalt(66d017b)
- **i18n:** Add pirate locale by @lyestarzalt(e852a33)
- **vatsim:** Add sector overlays and airport ATC details by @lyestarzalt(4da648c)
- **airport-info:** Expandable ILS detail per runway end by @lyestarzalt(103f155)
- **companion-apps:** Zustand store skeleton + CompanionApp type by @lyestarzalt(33bfdbb)
- **companion-apps:** Detached spawn wrapper with mocked tests by @lyestarzalt(a71045c)
- **companion-apps:** Curated suggested list with XPME entry by @lyestarzalt(7a148ea)
- **companion-apps:** IPC channel for launch + exe file picker by @lyestarzalt(379c6aa)
- **companion-apps:** Edit dialog with file picker integration by @lyestarzalt(0acb708)
- **companion-apps:** Settings section with list + suggested panel by @lyestarzalt(a3f697c)
- **companion-apps:** Expose section in SettingsDialog nav by @lyestarzalt(7393e32)
- **companion-apps:** Fire autoLaunch tools before X-Plane, toast failures by @lyestarzalt(75a0d40)
- **map:** Basemap-aware airport overlay with halo ring by @lyestarzalt(96f7807)
- **ui:** Add 6 shadcn primitives styled to design system by @lyestarzalt(bfdc184)
- **xp-log:** Pure parser with verified pattern + noise filter by @lyestarzalt(facda3e)
- **xp-log:** IPC handler reads last 5MB with no-path/no-log/error branches by @lyestarzalt(7121970)
- **xp-log:** Expose xpLogAPI via preload, register IPC in main by @lyestarzalt(2fa4b7e)
- **xp-log:** TanStack Query hook with enabled gating by @lyestarzalt(97aeb15)
- **xp-log:** Logs settings tab with parsed view + Sentry report dialog by @lyestarzalt(e446ed4)
- **xp-log:** Add search input and 'Open Log.txt' button by @lyestarzalt(cc936c2)
- **simbrief:** Curated format list + persisted FMS export targets by @lyestarzalt(bafab2f)
- **main:** IPC for downloading SimBrief FMS files + folder picker by @lyestarzalt(feb6898)
- **simbrief:** FMS export UI in settings + briefing dialog by @lyestarzalt(84e0bc5)
- **utils:** IsElevated + canExecute helpers by @lyestarzalt(51c6ea4)
- **companion-apps:** Elevation + access pre-flight, structured error codes by @lyestarzalt(37a39ed)
- **companion-apps:** Admin warning banner + clear toasts by @lyestarzalt(1231718)
- **utils:** ResolveLnkSync wrapper for Windows .lnk parsing by @lyestarzalt(60d5284)
- **scenery:** Follow .lnk shortcuts in SceneryManager dir walk by @lyestarzalt(2ece0fb)
- **scenery:** Resolve .lnk paths in SceneryManager.processEntry by @lyestarzalt(8b9418c)
- **scenery:** Follow .lnk shortcuts in customSceneryLoader airport scan by @lyestarzalt(c04e89f)
- **airport-jump:** Clickable ICAO codes across the UI by @lyestarzalt(d285818)
- **map:** Frame airports via fitBounds + drop detail layer minzoom dynamically by @lyestarzalt(21f4b50)
- **compass:** Show cursor terrain elevation under heading by @lyestarzalt(8ff3b90)

### Bug Fixes

- **window:** Render TitleBar on macOS with traffic-light clearance by @lyestarzalt(57550a6)
- **apt-parser:** Handle 8.33 kHz frequency rows and correct legacy mapping by @lyestarzalt(da78e74)
- **taxi-route:** Drop arrival gate dropdown — startPosition is the gate by @lyestarzalt(3c3cd5e)
- **main:** Timeout + logging on proxyFetch so the app never silently hangs by @lyestarzalt(ba6c82b)
- **i18n:** Sync locales and guard parity by @lyestarzalt(c50f853)
- **eslint:** Pin tsconfig root for editor linting by @lyestarzalt(cb3f9a4)
- **build:** Pin @xmldom/xmldom to 0.8.x for mac packaging by @lyestarzalt(0281eb3)
- **debug:** Position toolbar below custom title bar by @lyestarzalt(6c6cf6f)
- **simbrief:** Allow filenames with adjacent dots (regression) by @lyestarzalt(a526e85)
- **simbrief:** Derive export filename from OFP, not SimBrief response by @lyestarzalt(9351cb1)
- **airport-info:** Drop redundant Conditions heading in ConditionsCard by @lyestarzalt(8d8b94b)
- **companion-apps:** Scope elevation check to Windows only by @lyestarzalt(71d0ef0)
- **i18n:** Drop literal + from companionApps.addButton (icon already shows it) by @lyestarzalt(49de93e)
- **map:** Cap raster basemap source maxzoom at 19 by @lyestarzalt(6535e8f)
- **scenery:** Use logger.addon channel + complete the test logger mock by @lyestarzalt(4c0cf16)
- **test:** Skip Windows-only elevation check on POSIX platforms by @lyestarzalt(4ed575d)
- **taxi-route:** Start arrival route at the rollout end of the landing runway by @lyestarzalt(3e4730c)
- **map:** Cap maxPitch at 70 to dodge the click dead zone (#79) by @lyestarzalt(fbacf40)
- **map:** Slot taxi route between taxiway centerlines and markings by @lyestarzalt(c904ab5)
- **release-rc:** Bulletproof RC number resolution against paginated gh output by @lyestarzalt(a416ddd)
- **launch:** Keep gate selection and taxi route after Launch by @lyestarzalt(35441d0)

### Refactor

- **launch:** Extract FlightInit JSON builder into a dedicated module by @lyestarzalt(679452b)
- **launch:** Expose E2E_USER_DATA_DIR hook and gate the dev fuse for tests by @lyestarzalt(ef18425)
- **airport-info:** Redesign InfoTab with progressive disclosure by @lyestarzalt(2f00fd4)
- **metar:** Extract shared formatters into lib/utils/metar by @lyestarzalt(78fc0f1)
- **taxi-route:** Use ToggleGroup for direction toggle by @lyestarzalt(23c9c84)
- **settings:** Consolidate map render settings under Graphics by @lyestarzalt(51af780)
- **map:** Extract setupAirportsLayer to layers/world/ by @lyestarzalt(51ed4ee)
- **explore:** Tighten Featured + VATSIM tab hierarchy by @lyestarzalt(9085652)
- **logger:** Replace stray console.* with scoped logger by @lyestarzalt(b2a3193)
- **flight-init:** Consolidate JSON builder into flightInit/ folder by @lyestarzalt(1afc5cc)
- **flight-init:** One section helper per JSON field, builder is one expression by @lyestarzalt(11aa051)
- **launch:** Dedupe a string literal, neaten a few comments by @lyestarzalt(541b696)
- **xp-log:** Match settings page styling — small heading, outline buttons, top-right toolbar by @lyestarzalt(f1a8774)
- **xp-log:** Match Appearance tab structure (icon header + Separator + Card blocks) by @lyestarzalt(f40dc77)
- **xp-log:** Pivot to a real log viewer — parsed entries + level filter chips by @lyestarzalt(6e18650)
- **xp-log:** Drop Report this issue button and dialog by @lyestarzalt(94e04fe)
- **simbrief:** Pin Send to FMS row above the dialog footer by @lyestarzalt(0e16391)
- **debug:** Collapse top debug strip into title bar dropdown by @lyestarzalt(fd2fd2e)
- **taxi-route:** Render via native MapLibre layers instead of canvas by @lyestarzalt(62456f5)

### Documentation

- Update CHANGELOG.md for v1.7.0 by @github-actions[bot](512f9b9)
- **readme:** Mention X-Plane free demo for users without X-Plane by @lyestarzalt(d74bd93)
- **manual:** Add CLI flags reference and link from README by @lyestarzalt(734594b)
- Refresh contributor workflow by @lyestarzalt(212c228)

### Miscellaneous

- **issue-template:** Add X-Plane install type and Log.txt fields by @lyestarzalt(526c9f9)
- **deps:** Bump @types/node minor version by @lyestarzalt(56847fd)
- **tsconfig:** Include test files for type-checking, gitignore tsc dist by @lyestarzalt(a7f8e8c)
- **ui:** Add data-testid attributes for stable E2E selectors by @lyestarzalt(ca221d6)
- **deps:** Update maplibre-gl to ^5.24.0 by @lyestarzalt(d121d97)
- **deps:** Upgrade typescript to ^6.0.0 by @lyestarzalt(4a3ffd3)
- **deps:** Bump i18next, react-i18next, typescript-eslint by @lyestarzalt(3bee42b)
- Align project on Node 24 + pin xmldom by @lyestarzalt(35575fd)
- **deps:** Add @recent-cli/resolve-lnk for .lnk parsing by @lyestarzalt(a6b782f)

### CI/CD

- **release-rc:** Trim Discord changelog to user-facing changes by @lyestarzalt(d4fc54b)

### Release

- 1.8.0 by @github-actions[bot](40de745)

### I18n

- **graphics:** Fully translate the consolidated Graphics section by @lyestarzalt(f8b67da)
- **companion-apps:** Add settings.companionApps namespace by @lyestarzalt(57e7b21)
- **companion-apps:** Translate namespace into 9 locales + pirate by @lyestarzalt(f8420ea)
- **xp-log:** Add settings.logs.* and logs.patterns namespace (en only) by @lyestarzalt(ebf1a13)
- **xp-log:** Translate logs namespace into 10 locales by @lyestarzalt(b17b82a)
- **simbrief:** Translate FMS export namespace into 9 locales + pirate by @lyestarzalt(aa9e36e)
- **companion-apps:** Translate elevation + error keys into 9 locales + pirate by @lyestarzalt(95eb583)

### Test

- **launch:** Add unit tests for FlightInit JSON builder by @lyestarzalt(d2b95b2)
- **db:** Add corrupt-recovery and integrity tests by @lyestarzalt(4638fa4)
- **navdata:** Add spatial query, lookup, and search tests by @lyestarzalt(9284d77)
- **xplane:** Add boundary tests for paths, process check, version detector by @lyestarzalt(6c132c8)
- **e2e:** Add Playwright foundation with smoke, airport, and launch-flow tests by @lyestarzalt(9e2bb14)
- **companion-apps:** Cover addTool / updateTool / removeTool by @lyestarzalt(2dd4a60)
- **utils:** Minimal .lnk Buffer builder for fixture-free tests by @lyestarzalt(b5a1769)
- **utils:** Cover no-target branch in resolveLnkSync by @lyestarzalt(d58063a)
- **scenery:** Regression test for POSIX symlink path by @lyestarzalt(085b402)



### New Contributors

- @ made their first contribution
## v1.7.0 - 2026-04-26

### Features

- **parser:** Enrich taxi network parsing with full apt.dat 1200 spec by @lyestarzalt(59dd67a)
- **taxi-graph:** Add graph library with A* pathfinding by @lyestarzalt(ede4932)
- **taxi-route:** Add network mode with A* pathfinding to store by @lyestarzalt(7438563)
- **taxi-route:** Add FTG export and IPC for route file writing by @lyestarzalt(c750cbd)
- **taxi-route:** Network-aware rendering and UI with FTG export by @lyestarzalt(d3b64af)
- **taxi-route:** Redesign UX — gate→runway dropdown with auto-route by @lyestarzalt(90411bc)
- **taxi-route:** Drag-to-reroute via-point insertion by @lyestarzalt(c5c49d7)
- **taxi-route:** Drag-to-reroute with ghost preview and anchor management by @lyestarzalt(4a4b21d)
- **taxi-route:** Include apt.dat source file path in FTG export by @lyestarzalt(ddb2f6f)
- **taxi-route:** Enrich FTG export with taxiway names, distance, gate heading by @lyestarzalt(69552d2)
- **settings:** Add Graphics tab with approach light animation toggle by @lyestarzalt(5055ae1)
- **settings:** Add surface detail, taxiway glow, day/night, contour toggles by @lyestarzalt(ac4f748)
- **taxi-route:** Auto-write FTG route on launch, rename to route.json by @lyestarzalt(66c7f1e)
- **taxi-route:** Add timestamp and aircraft_icao to FTG route file by @lyestarzalt(5ca5073)
- **taxi-route:** Generic export tooltip, freehand route_free, drop distance_m by @lyestarzalt(2f1d7cf)
- **support:** Add donation prompt after 2nd launch and link in settings by @lyestarzalt(18500f1)
- **sentry:** Add context and breadcrumb subscribers by @lyestarzalt(eea3bf4)
- **sentry:** Wire context subscribers into renderer init by @lyestarzalt(15a6484)
- **i18n:** Add support tab translation keys by @lyestarzalt(216f345)
- **settings:** Create Support section with feedback form by @lyestarzalt(13d486f)
- **settings:** Add Support tab to settings sidebar by @lyestarzalt(a18fb12)

### Bug Fixes

- **loading:** Show OS-specific hints for file permission and lock errors by @lyestarzalt(832649b)
- **taxi-route:** Fix stale graph closure and enable click mode on activate by @lyestarzalt(67a4e48)
- **taxi-graph:** Include runway edges with penalty, filter to connected nodes by @lyestarzalt(8d0e150)
- **taxi-route:** Improve route line rendering by @lyestarzalt(334a206)
- **taxi-route:** Integrate panel into gate card and fix preview colors by @lyestarzalt(694581b)
- **taxi-route:** Integrate controls into gate card, unwrap route summary, add i18n by @lyestarzalt(49eff58)
- **taxi-route:** Fix Select uncontrolled-to-controlled warning by @lyestarzalt(00bd947)
- **map:** Fix airport switching black screen caused by animation blocking isStyleLoaded by @lyestarzalt(46055ad)
- **map:** Remove taxiway light animation entirely (fixes #59) by @lyestarzalt(101d1b8)
- **launch:** Add scroll-snap to livery grid for row-by-row scrolling by @lyestarzalt(0a0e8ef)
- **settings:** Remove day/night and contour toggles, fix migration by @lyestarzalt(6e0ea5c)
- **debug:** Remove misleading FPS counter from debug overlay by @lyestarzalt(c6e1ccf)
- **taxi-route:** Remove backtracking loops from resolved path by @lyestarzalt(51718a5)
- **taxi-route:** Compute taxiway names and distance from graph edges by @lyestarzalt(c69551a)
- **nav:** Fix nav layers disappearing after airport switch by @lyestarzalt(7dcd2cb)
- Exclude test files from tsconfig to avoid top-level await errors by @lyestarzalt(d984e0f)
- **lint:** Ignore design-system directory in eslint config by @lyestarzalt(113410b)
- **test:** Update chunk count after adding 10 more airport fixtures by @lyestarzalt(11abda9)
- **settings:** Add page header, Discord link, and fix Ko-fi label in Support tab by @lyestarzalt(59986fc)

### Performance

- **taxi-route:** Stop RAF loop when no route animation needed by @lyestarzalt(537fd4d)
- **map:** Throttle taxiway light animation to ~10fps (fixes #59) by @lyestarzalt(28d10e2)
- **map:** Disable approach light animation and idle orbit (#59) by @lyestarzalt(7b92efd)

### Refactor

- **map:** Use renderer metadata for clearAirport instead of string prefix by @lyestarzalt(2d90dca)
- **settings:** Move privacy and report issue to Support tab by @lyestarzalt(b75724d)

### Documentation

- Update CHANGELOG.md for v1.6.1 by @github-actions[bot](50633a9)
- **map:** Document airport switching fix — why safeRemove is bypassed by @lyestarzalt(2e44470)
- Add donation section to README by @lyestarzalt(e1b4153)
- Trim README, link to project page for full details by @lyestarzalt(6cd8f28)

### Miscellaneous

- **map:** Expose map instance on window.__map in dev mode by @lyestarzalt(9563b21)
- Add .agents/ to gitignore by @lyestarzalt(75bc612)
- Add vitest with config and test scripts by @lyestarzalt(a8ba2b1)
- Remove one-time fixture extraction script by @lyestarzalt(e27b4f2)
- **sentry:** Migrate to permanent project and upgrade packages by @lyestarzalt(df0353b)
- Replace issue templates with YAML forms and add config by @lyestarzalt(ef54dc1)

### Release

- 1.7.0 by @github-actions[bot](b0c10b6)

### Test

- Add X-Plane data fixtures for parser tests by @lyestarzalt(5f5ac0f)
- **parsers:** Add airport parser tests with real apt.dat fixtures by @lyestarzalt(5dd6983)
- **parsers:** Add navaid parser tests by @lyestarzalt(df2c702)
- **parsers:** Add waypoint, airway, and airspace parser tests by @lyestarzalt(61a79b2)
- Add in-memory DB test helper with Drizzle migrations by @lyestarzalt(7a6628a)
- **db:** Add schema and migration tests by @lyestarzalt(b9b34ee)
- **db:** Add airport cache pipeline tests by @lyestarzalt(4ae0f2c)
- **db:** Add nav data cache pipeline tests by @lyestarzalt(2c40397)
- **cache:** Add cache invalidation tests by @lyestarzalt(11128e5)
- **db:** Add custom scenery airport cache tests by @lyestarzalt(b6f11ff)
- Add 10 more airport fixtures covering heliports, seaplanes, and grass strips by @lyestarzalt(f1b5ffb)
- **parsers:** Add structural fingerprint regression tests for 15 airports by @lyestarzalt(6ed08ca)
- **parsers:** Add bezier, runway geometry, and path parser unit tests by @lyestarzalt(de9f1e6)


## v1.6.1 - 2026-04-16

### Features

- **debug:** Add layer inspector, draggable overlay, glassmorphism UI by @lyestarzalt(0b37278)
- **debug:** Show layer draw order in inspector by @lyestarzalt(6aeb922)
- **debug:** Detachable panels, layer toggle, prominent draw order by @lyestarzalt(5cd280b)
- **debug:** Tabbed toolbar with detachable panels, state inspector by @lyestarzalt(560a076)
- **debug:** Add file paths section to debug overlay Map tab by @lyestarzalt(1772e5a)
- **settings:** Add customLaunchArgs to launcher settings by @lyestarzalt(c5daa63)
- **config:** Add X-Plane CLI arg catalog by @lyestarzalt(fee7db0)
- **settings:** Add LaunchArgsCard component by @lyestarzalt(9943567)
- **settings:** Add launch args card to X-Plane section by @lyestarzalt(a21ec6b)
- **launch:** Send custom launch args on cold start by @lyestarzalt(b2953ca)
- **ci:** Replace deb/rpm with AppImage and add arm64 Linux builds by @lyestarzalt(b88bed9)
- **ci:** Auto-increment RC number from existing artifacts by @lyestarzalt(1bd653e)
- **debug:** Refactor DevDebugOverlay into folder, add DB panel and settings toggle by @lyestarzalt(8b41b5f)
- **taxi-route:** Click-to-add taxi route with canvas overlay by @Pwoodlock(6d67450)

### Bug Fixes

- **debug:** Center detached panels, bold ON/OFF toggle buttons by @lyestarzalt(807a81b)
- **ui:** Group airport filters under one section and fix hardcoded strings by @lyestarzalt(3f71a2a)
- **map:** Improve taxiway lights with 3-layer glow and add @types/three by @lyestarzalt(5b7fbbd)
- **scenery:** Preserve absolute paths and make analyze() read-only (#49) by @lyestarzalt(fa3f1d5)
- **settings:** Add i18n and improve launch args chip styling by @lyestarzalt(9d25c60)
- **settings:** Fix scroll in launch args dropdown and add i18n by @lyestarzalt(d6abb36)
- **ui:** Override Radix ScrollArea table display to prevent content clipping by @lyestarzalt(d2fd6f4)
- **db:** Auto-delete corrupt database and relaunch on migration failure by @lyestarzalt(6a3cba6)
- **taxi-route:** Clean up PR #58 to match project conventions by @lyestarzalt(e647869)

### Refactor

- **debug:** Replace floating overlay with tabbed toolbar by @lyestarzalt(644c36b)
- Enable noUncheckedIndexedAccess and fix all 388 errors by @lyestarzalt(7f6d11c)
- Enable noUnusedLocals and remove dead code across 28 files by @lyestarzalt(6925fd8)
- **logging:** Extract startup logs to startupLog.ts and add GPU/display diagnostics by @lyestarzalt(b8abe57)

### Documentation

- Update CHANGELOG.md for v1.6.0 by @github-actions[bot](eaeff41)
- Update README with recent features and expanded dev section by @lyestarzalt(7f3340c)
- Fix X-Plane version, show 3D terrain screenshot, trim dev section by @lyestarzalt(cad5be7)
- Add hits badge to README by @lyestarzalt(eda737f)
- Update README hero and Discord invite link by @lyestarzalt(b47f09f)
- Clean up and reword README by @lyestarzalt(2f748d7)
- Add install troubleshooting for Windows and macOS by @lyestarzalt(e042047)

### Miscellaneous

- Remove CLAUDE.md from tracking by @lyestarzalt(691fa05)
- Address high vulnerabilities by @necromeo(afc0f71)

### Release

- 1.6.1 by @github-actions[bot](3fafbe0)



### New Contributors

- @Pwoodlock made their first contribution
- @necromeo made their first contribution
## v1.6.0 - 2026-03-24

### Features

- **ui:** Auto-navigate to start tab and scroll to selected item by @lyestarzalt(59391d8)
- **launch:** Add runway start options — approach distance and glider tow by @lyestarzalt(cb15a61)
- **launch:** Add air start, carrier, and frigate start modes to pin drop by @lyestarzalt(6ca0112)

### Bug Fixes

- **launch:** Persist aircraft selection under actual type, not just active filter by @lyestarzalt(5067aa7)
- **map:** Rewrite taxiway lights as MapLibre circles and fix layer crash by @lyestarzalt(b0fa7c0)
- **addons:** Follow symlinks and junctions when scanning aircraft, plugins, and liveries by @lyestarzalt(0c1593e)
- **data:** Don't abort scenery scan when one symlink fails by @lyestarzalt(e7e0d2b)
- **ci:** Add download links to release and changelog to RC Discord notifications by @lyestarzalt(9ae1ded)
- **map:** Smaller taxiway lights with radiated glow effect by @lyestarzalt(797d922)

### Refactor

- **explore:** Rework panel as collapsible side panel by @lyestarzalt(16824cc)
- **explore:** Fix event list clipping and unify ICAO colors by @lyestarzalt(9eedad5)
- **map:** Redesign runway end markers to match gate visual style by @lyestarzalt(c0cf5a2)

### Documentation

- Update CHANGELOG.md for v1.5.5 by @github-actions[bot](030dcab)

### Miscellaneous

- Fix dependency vulnerabilities via npm audit fix by @lyestarzalt(f8672ae)
- **i18n:** Add runway start option translations for all locales by @lyestarzalt(3b0e075)
- **ci:** Standardize job and step naming across release workflows by @lyestarzalt(80ea170)

### Release

- 1.6.0 by @github-actions[bot](249c754)


## v1.5.5 - 2026-03-22

### Documentation

- Update CHANGELOG.md for v1.5.4 by @github-actions[bot](7ad9e76)

### CI/CD

- Rewrite release workflow and changelog config by @lyestarzalt(5db7eca)
- Skip redundant Sentry source map uploads on non-Linux builds by @lyestarzalt(0d63d20)

### Release

- 1.5.5 by @github-actions[bot](7511556)


## v1.5.4 - 2026-03-22

### Features

- **toolbar:** Add coordinate input to pin drop with split button by @lyestarzalt(ce4845a)
- **addons:** Add rescan button to scenery and browser tabs by @lyestarzalt(221576c)
- **addons:** Detect manually added scenery and show rescan feedback by @lyestarzalt(e907688)
- **map:** Interactive drag-to-resize range rings by @lyestarzalt(16482d3)
- **toolbar:** Add Ctrl+F / Cmd+F shortcut to focus airport search by @lyestarzalt(b894d86)
- **addons:** Show GLOBAL_AIRPORTS as draggable row with search bar by @lyestarzalt(f31faaf)
- **addons:** Add delete scenery from disk with confirmation by @lyestarzalt(22d2978)
- **app:** Add xdispatch:// deep link protocol for airport navigation by @lyestarzalt(0e816e1)
- **data:** Split airports into two tables for fast custom scenery resync by @lyestarzalt(5a64c1d)
- **map:** Add starfield background behind globe view by @lyestarzalt(923d4c5)

### Bug Fixes

- **ci:** Fix release notes not appearing on GitHub releases by @lyestarzalt(7970a79)
- **ci:** Use file-based release notes and harden workflow by @lyestarzalt(458d893)
- **addons:** Handle cross-drive install when temp and X-Plane are on different drives by @lyestarzalt(450713a)
- **addons:** Skip deleted scenery folders instead of showing ??? by @lyestarzalt(f10a48e)
- **addons:** Remove stale scenery entries from scenery_packs.ini by @lyestarzalt(083d1b7)
- **addons:** Fix drag-and-drop not working in installer by @lyestarzalt(6174347)
- **addons:** Sort new scenery into correct priority position in INI by @lyestarzalt(c4a045d)
- **app:** Prevent multiple instances from running simultaneously by @lyestarzalt(e47a4ea)
- **addons:** Fix landmarks misclassified as Airport by @lyestarzalt(8b1e078)
- **flightplan:** Clear old route and re-center when loading new file by @lyestarzalt(3c667dd)
- **ui:** Move flight plan close button to the left side by @lyestarzalt(afe8ddc)
- **addons:** Fix rescan spinner and add missing i18n keys by @lyestarzalt(a0bf9ac)

### Refactor

- **addons:** Simplify scenery toolbar, remove safe mode toggle by @lyestarzalt(a60a9f5)
- **map:** Redesign range rings with inline labels along the ring by @lyestarzalt(cc81fa0)
- **map:** Redesign custom airport pin to match design system by @lyestarzalt(258ad9e)
- **addons:** Polish scenery tab UI for consistency by @lyestarzalt(7a327f5)
- **addons:** Align browser tab toolbar with scenery tab design by @lyestarzalt(66c1349)
- **addons:** Remove check updates button and clean up browser tab by @lyestarzalt(b78fddb)

### Documentation

- Update CHANGELOG.md for v1.5.3 by @github-actions[bot](71a35f6)
- Update README screenshots and add fuel, weather, terrain views by @lyestarzalt(b1ba519)

### Release

- 1.5.4 by @github-actions[bot](e7e5ed0)


## v1.5.3 - 2026-03-18

### Features

- **launch:** Remember last livery per aircraft by @lyestarzalt(8068db2)
- **ci:** Add version bump and Discord notification to RC workflow by @lyestarzalt(5f671e8)
- **settings:** Add interface zoom control and fix launch dialog layout by @lyestarzalt(35cc049)
- **launch:** Remember last aircraft per type filter and improve star visibility by @lyestarzalt(5668558)

### Bug Fixes

- **tileCache:** Remove fake DEM tile fallback that warped terrain by @lyestarzalt(0d141dc)
- **flightplan:** Open dialog defaults to current install FMS plans folder by @lyestarzalt(e30b32a)
- **map:** Prevent terrain errors on style change and low zoom by @lyestarzalt(bf8db7b)
- **map:** Remove minzoom from DEM sources that broke terrain mesh by @lyestarzalt(dddcbfa)
- **layout:** Add min-w-0 to addon manager content area by @lyestarzalt(f29d977)
- **map:** Replace style.load race condition with getStyle guard by @lyestarzalt(c0332f7)

### Refactor

- **map:** Use transformStyle to preserve layers across basemap switches by @lyestarzalt(a0a4f9a)

### Documentation

- Update CHANGELOG.md for v1.5.2 by @github-actions[bot](cd1fcac)
- Rewrite README with complete feature inventory by @lyestarzalt(618796d)

### Release

- 1.5.3 by @github-actions[bot](55cf32a)


## v1.5.2 - 2026-03-16

### Features

- **map:** Add setting to toggle idle orbit camera, default off by @lyestarzalt(d48a616)
- **settings:** Add multi X-Plane installation support by @lyestarzalt(b0aacf3)

### Bug Fixes

- **settings:** Wrap installation name in brackets in window title by @lyestarzalt(e953904)
- **map:** Prevent terrain disappearing after zoom out, add dev debug overlay by @lyestarzalt(10cc5af)
- **queries:** Always rescan addon and aircraft lists on dialog open by @lyestarzalt(68367b2)

### Documentation

- Update CHANGELOG.md for v1.5.1 by @github-actions[bot](567e58f)

### Release

- 1.5.2 by @github-actions[bot](c0cb905)


## v1.5.1 - 2026-03-15

### Features

- **start-position:** Toggle deselect for gates, runway ends & helipads by @lyestarzalt(33ee35b)
- **map:** Add disk tile cache for MapLibre by @lyestarzalt(5f57146)
- **map:** Add hillshade and contour lines to terrain visualization by @lyestarzalt(be4e92f)
- **map:** Add idle orbit camera around selected airport by @lyestarzalt(60fa1a3)
- **map:** Add terrain shading toggle to toolbar overlays by @lyestarzalt(bb03162)
- **settings:** Add close-on-launch option, remove networks tab by @lyestarzalt(d61797c)
- **window:** Display app version in title bar by @lyestarzalt(24800fa)
- **loading:** Add two-phase loading screen with granular airport progress by @lyestarzalt(e4c48e4)
- **data:** Detect symlinked scenery packs in Custom Scenery folder by @lyestarzalt(9406d66)
- **branding:** Redesign app icon and inline SVG logo component by @lyestarzalt(dda765a)

### Bug Fixes

- **ci:** Include arch in Windows and Linux binary names by @lyestarzalt(31061ef)
- **data:** Validate airport cache on startup before marking as loaded by @lyestarzalt(ae644d1)
- **launch:** Place fuel in correct X-Plane tank slot for third-party aircraft by @lyestarzalt(8041fc0)
- **addons:** Harden scenery detection and improve addon manager UI by @lyestarzalt(b2d18d2)
- **launch:** Exclude AI traffic .acf files from aircraft scanner by @lyestarzalt(d2d6809)
- **addons:** Allow backslash in aircraft folder paths for livery scanning by @lyestarzalt(1587ef9)
- **map:** Prevent terrain crashes on globe projection and silence DEM errors by @lyestarzalt(eb8e070)

### Documentation

- Update CHANGELOG.md for v1.5.0 by @github-actions[bot](d3f585f)
- Update Discord invite link by @lyestarzalt(22e14ff)

### Miscellaneous

- **db:** Add dbCredentials to drizzle config for Drizzle Studio by @lyestarzalt(1203801)

### Release

- 1.5.1 by @github-actions[bot](ba7c9ae)

### Wip

- **ils:** Scaffold 3D glide slope visualization (disabled) by @lyestarzalt(b028548)


## v1.5.0 - 2026-03-12

### Features

- **weather:** Redesign WeatherDialog with interactive altitude diagram by @lyestarzalt(6826eb9)
- **weather:** Add environment controls, i18n, and fix dialog sizing by @lyestarzalt(fb2c054)
- **map:** Add day/night terminator overlay by @lyestarzalt(2ffad99)
- **map:** Add range rings layer for aircraft category reach visualization by @lyestarzalt(72d9f3e)
- **map:** Add pin-drop custom start location by @lyestarzalt(137a0fc)
- **launcher:** Persist aircraft list filters across sessions by @lyestarzalt(300ad1f)
- **map:** Render aircraft silhouettes for VATSIM/IVAO traffic by @lyestarzalt(cf14265)
- **map:** Redesign player aircraft icon with canvas-based rendering by @lyestarzalt(403ae66)
- **xplane:** Detect aircraft category from X-Plane metadata datarefs by @lyestarzalt(af2224a)
- **flight-strip:** Redesign with grouped layout, color-coded values, drag-to-reposition & new datarefs by @lyestarzalt(a3b59d1)
- **logbook:** Save last 10 launches with browse & restore by @lyestarzalt(0b3c859)

### Bug Fixes

- **ui:** Add forwardRef to Badge component by @lyestarzalt(2f1f4cf)
- **ui:** Correct ref types and add missing forwardRef in shadcn components by @lyestarzalt(b29b9fb)
- **launcher:** Derive fuel tank ratios from _cgpt capacity for third-party helicopters by @lyestarzalt(568afaf)
- **launcher:** Skip --version on Windows Steam to avoid launch dialog by @lyestarzalt(1223c8f)
- **launcher:** Correct fuel tank count for third-party aircraft by @lyestarzalt(993d7c9)
- **launcher:** Improve fuel parsing and add payload fallback for third-party aircraft by @lyestarzalt(d833981)
- **launcher:** Adjust sun arc horizon line based on day length by @lyestarzalt(fa7fc12)
- **launcher:** Persist aircraft path instead of full object to prevent stale livery/config by @lyestarzalt(7db1445)
- **map:** Clear selected procedure when flight plan is removed by @lyestarzalt(4adb08d)
- **map:** Replace deferred layer removal with synchronous getStyle guard by @lyestarzalt(ddb4116)
- **addons:** Invalidate launcher aircraft cache after addon mutations by @lyestarzalt(60aad9d)

### Refactor

- **ui:** Clean up LoadingScreen design system usage and dead code by @lyestarzalt(a25ae6d)
- **ui:** Add categorical color tokens to design system by @lyestarzalt(cc8104d)
- **ui:** Convert remaining hardcoded colors to design system tokens by @lyestarzalt(320c378)
- **ui:** Use correct shadcn/ui components for tabs, toggles, and buttons by @lyestarzalt(1fb73a3)
- **ui:** Centralize Badge variants, Button tooltips, and Spinner component by @lyestarzalt(ade11ac)
- **ui:** Add Input icon slots, improve FlightConfig layout and token usage by @lyestarzalt(d9ebc19)
- **websocket:** Replace ad-hoc reconnect with state machine, backoff & keepalive by @lyestarzalt(6119d6e)

### Documentation

- Update CHANGELOG.md for v1.4.1 by @github-actions[bot](9d2d105)

### Miscellaneous

- **ci:** Add separate mac arm64/x64 builds and rename artifacts by @lyestarzalt(40fd2ac)

### Release

- 1.5.0 by @github-actions[bot](7ab9b2c)


## v1.4.1 - 2026-03-06

### Features

- **map:** Add country and surface type airport filters by @lyestarzalt(66e709f)
- **data:** Detect and store exact X-Plane version by @lyestarzalt(9c5ec6b)
- **gateway:** Detect and display newer Gateway scenery releases by @lyestarzalt(66c3dbc)

### Bug Fixes

- **simbrief:** Prevent empty object rendering in VerticalProfile tooltip by @lyestarzalt(85b7182)
- **launcher:** Handle CRLF line endings and missing tank names in ACF parser by @lyestarzalt(8c73b47)
- **addon-manager:** Always detect .acf as aircraft regardless of nesting by @lyestarzalt(acee2ea)
- **addon-manager:** Resolve 7zip binary path and add alpha badge by @lyestarzalt(f95766f)
- **launcher:** Switch ramp spawn from lle_ground_start to ramp_start by @lyestarzalt(d45f2f3)
- **map:** Update existing sources when switching airports by @lyestarzalt(66b5f6e)
- **db:** Handle Windows file lock when deleting stale database by @lyestarzalt(6384c0c)
- **sentry:** Skip renderer error reporting in development by @lyestarzalt(1572a0f)

### Documentation

- Update CHANGELOG.md for v1.4.0 by @github-actions[bot](d926081)

### Miscellaneous

- **about:** Add Gilles to credits as special thanks for testing by @lyestarzalt(e985061)
- Add emojis to README and gitignore design system files by @lyestarzalt(f149241)

### Release

- 1.4.1 by @github-actions[bot](3374b10)


## v1.4.0 - 2026-03-03

### Features

- **networks:** Add IVAO online network support with mutual exclusivity by @lyestarzalt(8b4b124)
- **launcher:** Add Weight, Balance & Fuel dialog with per-tank fuel and payload stations by @lyestarzalt(37f4290)
- **launcher:** Add weather customization with presets and custom mode by @lyestarzalt(2c71aad)
- **launcher:** Replace SunArc with visual celestial arc component by @lyestarzalt(d375ea9)

### Bug Fixes

- **ivao:** Add null guards for external API data by @lyestarzalt(022600d)

### Refactor

- **launcher:** Clean up FlightConfig sidebar layout by @lyestarzalt(22ca286)

### Documentation

- Update CHANGELOG.md for v1.3.2 by @github-actions[bot](e423c01)

### Release

- 1.4.0 by @github-actions[bot](6232e9c)


## v1.3.2 - 2026-03-03

### Bug Fixes

- **map:** Improve MapLibre error logging and SVG icon loading by @lyestarzalt(610d39b)
- **addon-manager:** User-friendly error for EPERM in protected X-Plane folders by @lyestarzalt(cb94a92)
- **simbrief:** Guard against non-string NOTAM and SIGMET fields by @lyestarzalt(618fd1e)
- **map:** Guard against NaN coordinates in fitMapToFlightPlan by @lyestarzalt(8d39912)
- **launcher:** Preserve unrecognized lines in Freeflight.prf by @lyestarzalt(7b500af)
- **addon-manager:** Preserve scenery_packs.ini order and disable by default by @lyestarzalt(588ee1a)
- **compass:** Normalize bearing to 0-360 instead of -180 to 180 by @lyestarzalt(d11594b)

### Refactor

- **toolbar:** Consolidate 12 items into 7 for narrow-screen support by @lyestarzalt(11de983)
- **launcher:** Use FlightInit JSON for cold start instead of Freeflight.prf by @lyestarzalt(d4d2f67)
- **ui:** Move addon manager from settings to toolbar by @lyestarzalt(a59c67a)
- **addon-manager:** Always show in toolbar and indicate order is preserved by @lyestarzalt(4559f89)

### Documentation

- Update CHANGELOG.md for v1.3.1 by @github-actions[bot](ca96d0c)

### Miscellaneous

- **deps:** Upgrade maplibre-gl to ^5.19.0 by @lyestarzalt(8ab9a84)
- **launcher:** Add TODO for --no_save_prefs user settings issue by @lyestarzalt(27820fd)
- **launcher:** Add TODO for pgrep false positive on macOS by @lyestarzalt(3d0151f)

### Release

- 1.3.2 by @github-actions[bot](82bc52b)


## v1.3.1 - 2026-03-01

### Bug Fixes

- **map:** Defer layer removal when MapLibre is mid-render by @lyestarzalt(a84d476)
- **simbrief:** Surface real API error message instead of generic HTTP 400 by @lyestarzalt(d092def)
- **map:** Fix taxiway name layer interpolation and visibility by @lyestarzalt(d85b6e3)
- **simbrief:** Sanitize API response to handle empty objects by @lyestarzalt(dc44185)
- Terrain DEM maxzoom and SimBrief array coercion crashes by @lyestarzalt(40a9bc7)
- **sentry:** Fix source map uploads and VerticalProfile crash by @lyestarzalt(6a028ad)
- **simbrief:** Tell user to generate a flight plan on simbrief.com first by @lyestarzalt(491ae8d)

### Documentation

- Update CHANGELOG.md for v1.3.0 by @github-actions[bot](5ba61e0)

### Release

- 1.3.1 by @github-actions[bot](ed300d0)


## v1.3.0 - 2026-03-01

### Features

- **settings:** Add user-configurable font size (small/medium/large) by @lyestarzalt(ff974a2)
- **launcher:** Persist flight config across sessions by @lyestarzalt(bafac37)
- **map:** Add airport dot filters (type, custom scenery) by @lyestarzalt(74a22d7)
- **map:** Add taxiway name labels from taxi route network by @lyestarzalt(ad1e075)
- **map:** Add live weather radar overlay using RainViewer API by @lyestarzalt(603ee68)

### Bug Fixes

- **ui:** Increase base text size from text-xs to text-sm across all components by @lyestarzalt(23a39e7)
- **db:** Replace broken migration system with schema fingerprinting by @lyestarzalt(fdc3677)
- **main:** Retry DB init on failure to prevent zombie app state by @lyestarzalt(604fb2c)
- **db:** Harden startup against all DB failure paths by @lyestarzalt(4bb1e72)
- **main:** Move window security handlers into createWindow by @lyestarzalt(abdc055)

### Refactor

- **layers:** Centralize zoom levels with named ZOOM_LEVEL constants by @lyestarzalt(1ea12bf)

### Documentation

- Update CHANGELOG.md for v1.2.1 by @github-actions[bot](420b945)
- Add Ko-fi donation badge and link by @lyestarzalt(b0cce0f)
- Move macOS install notice below intro section by @lyestarzalt(fd944ae)
- Update X-Plane requirement to 12.4+ by @lyestarzalt(8ef8830)

### Release

- 1.3.0 by @github-actions[bot](109b094)


## v1.2.1 - 2026-02-28

### Features

- **gates:** Square helipad backgrounds with heading indicator by @lyestarzalt(57fd3ca)

### Bug Fixes

- **parser:** Gates pointing wrong direction due to negative headings in apt.dat by @lyestarzalt(049692e)

### Documentation

- Add CHANGELOG.md and auto-update on release by @lyestarzalt(5be512d)
- Add star prompt to README by @lyestarzalt(cafd26e)

### Miscellaneous

- Update package.json keywords and description by @lyestarzalt(46988ca)

### CI/CD

- Add Discord notification on release by @lyestarzalt(5f3b7c6)
- **release:** Pull latest before changelog commit in finalize step by @lyestarzalt(ac8dcec)

### Release

- 1.2.1 by @github-actions[bot](1583ea1)


## v1.2.0 - 2026-02-28

### Features

- **map:** Add phase-colored route, T/C T/D markers, and alternate airport to flight plan layer by @lyestarzalt(d4302c6)
- **simbrief:** Expand OFP dialog with vertical profile, navlog, performance, and briefing tabs by @lyestarzalt(8c47571)

### Bug Fixes

- **sentry:** Upload source maps for all processes and enable tracing and session replay by @lyestarzalt(edf288b)

### Documentation

- Update flight setup screenshot by @lyestarzalt(f4bc66c)

### Release

- 1.2.0 by @github-actions[bot](89c4ac4)


## v1.1.0 - 2026-02-27

### Features

- **addon-manager:** Add core types and Result utilities by @lyestarzalt(59e8343)
- **addon-manager:** Add scenery_packs.ini parser by @lyestarzalt(937fb45)
- **addon-manager:** Add DSF binary header parser by @lyestarzalt(3eea54a)
- **addon-manager:** Add folder scanner for classification by @lyestarzalt(3a3ae20)
- **addon-manager:** Add scenery classifier with priority tiers by @lyestarzalt(8a7b4a5)
- **addon-manager:** Add SceneryManager class by @lyestarzalt(9d68184)
- **addon-manager:** Extract IPC handlers to separate module by @lyestarzalt(26a6e54)
- **addon-manager:** Add React Query hooks by @lyestarzalt(b842fcd)
- **addon-manager:** Add Addon Manager dialog UI by @lyestarzalt(46ee67c)
- **addon-manager:** Integrate with main process and UI by @lyestarzalt(8a111f3)
- **addon-browser:** Add browser types by @lyestarzalt(b17f5ce)
- **addon-browser:** Add version detector module by @lyestarzalt(b7d5dbc)
- **addon-browser:** Add aircraft scanner by @lyestarzalt(46bc1d7)
- **addon-browser:** Implement installed addon browser with security hardening by @lyestarzalt(ba7500d)
- **installer:** Add installer types by @lyestarzalt(382e171)
- **installer:** Add archive scanner for ZIP/7z/RAR by @lyestarzalt(e61ccee)
- **installer:** Add type detector for addon classification by @lyestarzalt(8758974)
- **installer:** Add InstallerManager with analyze method by @lyestarzalt(059d9ef)
- **installer:** Add installer:analyze IPC handler by @lyestarzalt(0c261a3)
- **installer:** Add installer preload API by @lyestarzalt(1a262fd)
- **installer:** Add useInstallerAnalyze hook by @lyestarzalt(5e0e119)
- **installer:** Add InstallerTab UI with DropZone by @lyestarzalt(2f12a08)
- **installer:** Integrate InstallerTab into AddonManager by @lyestarzalt(b2d6699)
- **installer:** Add click-to-browse file picker by @lyestarzalt(d41d5ff)
- **installer:** Implement Phase 2 addon installation by @lyestarzalt(159b74e)
- **addon-manager:** Add logging for key operations by @lyestarzalt(8d79113)
- **addon-manager:** Add i18n support by @lyestarzalt(83b1925)
- **addon-manager:** Complete i18n for all components by @lyestarzalt(5ec780a)
- **i18n:** Add addonManager translations for all languages by @lyestarzalt(35478bb)
- **addon-manager:** Redesign UI/UX for all tabs by @lyestarzalt(94be0c9)
- **toolbar:** Add Alpha badge to Addons button by @lyestarzalt(d493b9c)
- **simbrief:** Add SimBrief flight plan import integration by @lyestarzalt(940096c)

### Bug Fixes

- Resolve multiple Sentry bugs by @lyestarzalt(0ed0597)
- **map:** Defer layer removal during render to prevent MapLibre crash by @lyestarzalt(3d60af4)
- **map:** Throttle approach light animation to 30fps by @lyestarzalt(6444029)
- **tracker:** Clear stale flight data on reconnect and add reconnect button by @lyestarzalt(22f2ada)
- **addon-manager:** Add backup cleanup and error handling by @lyestarzalt(60a5624)
- **apt-parser:** Handle seaplane and heliport headers by @lyestarzalt(ea04c55)
- **installer:** Address null safety issues by @lyestarzalt(1b957f8)
- **installer:** Remove duplicate empty state text by @lyestarzalt(accf67d)
- Remove plane marker when X-Plane process stops by @lyestarzalt(a4c69b6)

### Refactor

- **db:** Replace manual SQL with Drizzle migrations by @lyestarzalt(3eeb945)

### Documentation

- Update README with SimBrief and Addon Manager features by @lyestarzalt(35bbfba)
- Add starting position and tracking screenshots, update Discord link by @lyestarzalt(dcf87a0)
- Update settings screenshot by @lyestarzalt(68d9556)

### Miscellaneous

- Add TODO for TerrainControl crash issue by @lyestarzalt(2dc4e60)
- **ci:** Add commit links to changelog by @lyestarzalt(9e89f86)
- Add memory optimization TODO by @lyestarzalt(ca049b6)
- Add archive handling dependencies by @lyestarzalt(244b54d)
- Remove debug console.log statements by @lyestarzalt(9baed2a)

### Release

- 1.1.0 by @github-actions[bot](2658ee0)


## v1.0.0 - 2026-02-24

### Features

- Add flight plan loading and nav layer consolidation by @lyestarzalt(ab6f7c9)
- Add follow mode for plane tracking by @lyestarzalt(9122162)
- Add Sentry error tracking integration by @lyestarzalt(287cd7c)
- **flightplan:** Enrich waypoints with nav database info by @lyestarzalt(237efe3)
- **metar:** Integrate metar-taf-parser library for proper METAR decoding by @lyestarzalt(24a6bfd)
- **i18n:** Add translations for toolbar tooltips and airport panel by @lyestarzalt(d232755)
- **map:** Custom airport markers and navigation fixes by @lyestarzalt(29cbdac)
- **map:** Use pin beacon icon for custom airports by @lyestarzalt(72b09d8)
- **launch:** Improve flight config UI and require start position by @lyestarzalt(8406616)
- **logging:** Add production support logging for user diagnostics by @lyestarzalt(b09c2eb)
- **privacy:** Add opt-out crash reporting toggle in settings by @lyestarzalt(fd3e6e6)

### Bug Fixes

- Add SQLite caching for navigation data by @lyestarzalt(c3c8812)
- Track nav data source type for Navigraph switching by @lyestarzalt(dbb24b8)
- Add migration for source_type column in nav_file_meta by @lyestarzalt(a49aceb)
- Add null guards to prevent 'getLayer' errors on undefined map by @lyestarzalt(2b204f8)
- Properly re-add layers after map style change by @lyestarzalt(b43cbeb)
- Centralize styleVersion subscription to avoid HMR errors by @lyestarzalt(bc3fa33)
- **ui:** Improve main UI layout and UX by @lyestarzalt(bb8f4b4)
- **ui:** Position FlightStrip above FlightPlanBar when visible by @lyestarzalt(8719458)
- Prevent programmatic map movements from disabling follow mode by @lyestarzalt(7e749b8)
- Improve plane tracking and fix airport layer displacement by @lyestarzalt(8312af6)
- Remove Sentry from preload (incompatible with sandbox) by @lyestarzalt(edbe735)
- **map:** Prevent getLayer crashes after map destruction by @lyestarzalt(92f128e)
- **map:** Simplify style change handling to prevent crashes by @lyestarzalt(7f295dd)
- **validation:** Allow X-Plane internal airport IDs up to 7 chars by @lyestarzalt(6f06878)
- **ux:** Add tooltip to disabled Launch button by @lyestarzalt(b0ed84d)
- **layout:** Restructure top bar and sidebar positioning by @lyestarzalt(32ddb27)
- **ui:** Restore CompassWidget and fix positioning by @lyestarzalt(f5d15c6)
- **procedures:** Improve CIFP parsing for SID/STAR/Approach accuracy by @lyestarzalt(dec67a2)
- **ui:** Restore ExplorePanel and fix route antimeridian crossing by @lyestarzalt(f970e2b)
- **airspace:** Ensure counter-clockwise winding for GeoJSON polygons by @lyestarzalt(a502fad)
- **airspace:** Filter out antimeridian-crossing polygons by @lyestarzalt(e8f48ab)
- **readme:** Add cache-busting param to shields.io badges by @lyestarzalt(3658fbc)

### Refactor

- Consolidate navigation types with proper enums by @lyestarzalt(fa6b823)
- **ui:** Improve FlightPlanBar layout and interactions by @lyestarzalt(4ef2936)
- Rename Sidebar to AirportInfoPanel and remove FlightPlanTab by @lyestarzalt(6f3f544)
- **compass:** Remove wind indicator, keep only heading by @lyestarzalt(9caa9a1)
- **ui:** Redesign AirportInfoPanel with better info hierarchy by @lyestarzalt(3eafde0)
- **launch:** Redesign aircraft preview with livery navigation by @lyestarzalt(1caa3c8)

### Documentation

- Add open source community templates by @lyestarzalt(6b214d4)
- **readme:** Add Discord badge, tech stack badges, and support section by @lyestarzalt(dab3205)
- Add flight plan screenshot to README by @lyestarzalt(0cfbed0)

### Miscellaneous

- Add Sentry source maps and conventional changelog by @lyestarzalt(ae69cc2)
- Update Sentry config with env vars for org/project by @lyestarzalt(87498ae)

### Release

- 1.0.0 by @github-actions[bot](bb630f9)


## v0.9.4 - 2026-02-19

### Bug Fixes

- Improve launch logging and folder picker reliability by @lyestarzalt(d2588f5)

### Release

- 0.9.4 by @github-actions[bot](06dc2a7)


## v0.9.3 - 2026-02-19

### Features

- Parse startup location metadata (row code 1301) by @lyestarzalt(f8fc584)
- Use precise coordinates for REST API ramp spawning by @lyestarzalt(9af7e15)

### Bug Fixes

- Preserve user preferences when writing Freeflight.prf by @lyestarzalt(63a7690)
- Include ws and related packages in build by @lyestarzalt(ad55436)
- Prevent database closing on macOS window close by @lyestarzalt(736454b)

### Refactor

- Extract launch execution logic to dedicated executor module by @lyestarzalt(89de9db)

### Miscellaneous

- Add TODO comments for freeflightGenerator refactoring by @lyestarzalt(97c3e37)

### Release

- 0.9.3 by @github-actions[bot](ceb8111)


## v0.9.2 - 2026-02-19

### Bug Fixes

- Package electron-squirrel-startup for Windows builds by @lyestarzalt(ce65589)

### Release

- 0.9.2 by @github-actions[bot](273f536)


## v0.9.1 - 2026-02-18

### Refactor

- Architecture overhaul with TanStack Query, centralized types, and spawn fixes (#24) by @lyestarzalt(24c8f38)

### Release

- 0.9.1 by @github-actions[bot](6cb7933)


## v0.9.0 - 2026-02-13

### Documentation

- Update screenshots to reflect new UI by @lyestarzalt(2cc2f51)

### Release

- 0.9.0 by @github-actions[bot](f9b56f2)


## v0.8.0 - 2026-02-08

### Release

- 0.8.0 by @github-actions[bot](05b3bf9)


## v0.7.0 - 2026-02-07

### Features

- **signs:** Render airport signs as proper SVG rectangles by @lyestarzalt(f1eaf20)
- **layers:** Add helipad, beacon, and tower layers by @lyestarzalt(aa4091b)
- **ui:** X-Plane design system overhaul and unit preferences by @lyestarzalt(610f18f)
- Load React DevTools in development mode by @lyestarzalt(8956a62)
- **db:** Add aptFileMeta table and airport metadata columns by @lyestarzalt(9c00050)
- **db:** Update table creation for new schema by @lyestarzalt(ca8b644)
- **xplane:** Add types for apt.dat parsing by @lyestarzalt(3685ec5)
- **xplane:** Add file mtime checking for cache invalidation by @lyestarzalt(454ee8a)
- **xplane:** Extract 1302 metadata during apt.dat parsing by @lyestarzalt(52d2e9b)
- **xplane:** Implement batch inserts and cache checking by @lyestarzalt(0809a10)
- **xplane:** Update clear to also clear aptFileMeta by @lyestarzalt(3abed83)
- Add Explore feature for discovering airports and routes (#14) (#15) by @lyestarzalt(f3dcc4c)

### Bug Fixes

- **layers:** Add barIndex for approach lights and extract surface types by @lyestarzalt(7949175)
- **aptParser:** Fix bezier curve parsing for smooth pavements by @lyestarzalt(1e341c0)
- **runways:** Render shoulders with default width when not specified by @lyestarzalt(00b2d19)
- **linearFeature:** Airport lines not rendred properly by @lyestarzalt(6150097)
- **airspace:** Improve label readability with line placement by @lyestarzalt(f72810e)
- CSP, sign scaling, and sign parsing issues by @lyestarzalt(48eb72d)
- **signs:** Use constant icon size and trigger repaint after image load by @lyestarzalt(13667bd)
- **signs:** Pre-generate all sign images before adding layer by @lyestarzalt(a01f4fc)
- **types:** Sync Aircraft interface in preload.ts with launcher types by @lyestarzalt(4754010)

### Refactor

- **layers:** Standardize map layers with class-based architecture by @lyestarzalt(7fb728d)
- **nav-layers:** Consolidate config and remove legacy exports by @lyestarzalt(33f80bc)
- **signs:** Use text labels instead of SVG images, fix CSP for Google Fonts by @lyestarzalt(1b11dc5)

### Documentation

- **plans:** Add sign layer redesign spec by @lyestarzalt(4eadb5d)
- Add apt.dat cache invalidation design by @lyestarzalt(eb4f703)
- Add implementation plan for apt.dat cache by @lyestarzalt(3b7ebb2)

### Miscellaneous

- Remove unused MORA and MSA layer code by @lyestarzalt(55b8dc0)
- Disable sign layer temporarily by @lyestarzalt(e7fa7a3)

### Release

- 0.7.0 by @github-actions[bot](b780a9c)


## v0.6.1 - 2026-02-03

### Miscellaneous

- Fix repo URLs and add macOS install note (#10) by @lyestarzalt(55ea3f1)
- **ui:** Shadcn components, semantic colors, Map refactor & compass redesign  (#11) by @lyestarzalt(3620f16)

### Release

- 0.6.1 by @github-actions[bot](e5e4a88)


## v0.6.0 - 2026-02-02

### Features

- **launcher:** Add cold & dark and system time options by @lyestarzalt(c38628f)

### Documentation

- Enhance README with logo and screenshots by @lyestarzalt(af08967)

### Release

- 0.6.0 by @github-actions[bot](311de60)


## v0.5.3 - 2026-02-02

### Features

- Add Dependabot configuration by @lyestarzalt(c9e3755)

### Bug Fixes

- Hide menu bar and disable devtools in production by @lyestarzalt(799df0a)

### Refactor

- Simplify release workflow by @lyestarzalt(6e24b15)

### Release

- 0.5.3 by @github-actions[bot](96c4719)



### New Contributors

- @github-actions[bot] made their first contribution
- @lyestarzalt made their first contribution
<!-- generated by git-cliff -->
