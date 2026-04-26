# Changelog

All notable changes to this project will be documented in this file.
## v1.7.0 - 2026-04-26

### Features

- **parser:** Enrich taxi network parsing with full apt.dat 1200 spec by @lyestarzalt([59dd67a](https://github.com/lyestarzalt/x-dispatch/commit/59dd67accac701caddfb5241bfdca42154d7c003))
- **taxi-graph:** Add graph library with A* pathfinding by @lyestarzalt([ede4932](https://github.com/lyestarzalt/x-dispatch/commit/ede4932befd922250e43ae80d3a472c7576bc8d1))
- **taxi-route:** Add network mode with A* pathfinding to store by @lyestarzalt([7438563](https://github.com/lyestarzalt/x-dispatch/commit/743856374a924b86c3df2078e58a5bea63df5af5))
- **taxi-route:** Add FTG export and IPC for route file writing by @lyestarzalt([c750cbd](https://github.com/lyestarzalt/x-dispatch/commit/c750cbd93b2299a7cffb263d5feab92599c8faaf))
- **taxi-route:** Network-aware rendering and UI with FTG export by @lyestarzalt([d3b64af](https://github.com/lyestarzalt/x-dispatch/commit/d3b64affe1024c378712609f05d356243fed5ba5))
- **taxi-route:** Redesign UX — gate→runway dropdown with auto-route by @lyestarzalt([90411bc](https://github.com/lyestarzalt/x-dispatch/commit/90411bcaa2e45dba1448b5439d342e79d7dea331))
- **taxi-route:** Drag-to-reroute via-point insertion by @lyestarzalt([c5c49d7](https://github.com/lyestarzalt/x-dispatch/commit/c5c49d7fde2bc9f4879ba1cbd4aee80ab4af3335))
- **taxi-route:** Drag-to-reroute with ghost preview and anchor management by @lyestarzalt([4a4b21d](https://github.com/lyestarzalt/x-dispatch/commit/4a4b21dda12123fd2cc872f27e8cd054c09ad0c7))
- **taxi-route:** Include apt.dat source file path in FTG export by @lyestarzalt([ddb2f6f](https://github.com/lyestarzalt/x-dispatch/commit/ddb2f6fadb38644d1647a5ff2fa0a22f38cd5b98))
- **taxi-route:** Enrich FTG export with taxiway names, distance, gate heading by @lyestarzalt([69552d2](https://github.com/lyestarzalt/x-dispatch/commit/69552d2284ca9de47be2fca06fb00360667548d7))
- **settings:** Add Graphics tab with approach light animation toggle by @lyestarzalt([5055ae1](https://github.com/lyestarzalt/x-dispatch/commit/5055ae1e7b67585c3e0dc64102bc5613a0db5913))
- **settings:** Add surface detail, taxiway glow, day/night, contour toggles by @lyestarzalt([ac4f748](https://github.com/lyestarzalt/x-dispatch/commit/ac4f748f3ed70e342a5cd2ff2946ef097feb83ae))
- **taxi-route:** Auto-write FTG route on launch, rename to route.json by @lyestarzalt([66c7f1e](https://github.com/lyestarzalt/x-dispatch/commit/66c7f1e8d28f5904ad8da14c4ddea868b348c97a))
- **taxi-route:** Add timestamp and aircraft_icao to FTG route file by @lyestarzalt([5ca5073](https://github.com/lyestarzalt/x-dispatch/commit/5ca507332d8b4167db9508d4d0dbc88310ead417))
- **taxi-route:** Generic export tooltip, freehand route_free, drop distance_m by @lyestarzalt([2f1d7cf](https://github.com/lyestarzalt/x-dispatch/commit/2f1d7cf436d647f2860156822947e1ec60672adb))
- **support:** Add donation prompt after 2nd launch and link in settings by @lyestarzalt([18500f1](https://github.com/lyestarzalt/x-dispatch/commit/18500f192cb7edbbc386fb5a63534743d7569a3d))
- **sentry:** Add context and breadcrumb subscribers by @lyestarzalt([eea3bf4](https://github.com/lyestarzalt/x-dispatch/commit/eea3bf49a604f2512d0e0be1d094a3344ee22801))
- **sentry:** Wire context subscribers into renderer init by @lyestarzalt([15a6484](https://github.com/lyestarzalt/x-dispatch/commit/15a6484a02165307660fd1d01fb06c932817b74d))
- **i18n:** Add support tab translation keys by @lyestarzalt([216f345](https://github.com/lyestarzalt/x-dispatch/commit/216f3456d7ebcac2d75c9c3b55892db4c3747240))
- **settings:** Create Support section with feedback form by @lyestarzalt([13d486f](https://github.com/lyestarzalt/x-dispatch/commit/13d486f01c0f22a364da869388969095f1977b60))
- **settings:** Add Support tab to settings sidebar by @lyestarzalt([a18fb12](https://github.com/lyestarzalt/x-dispatch/commit/a18fb121f5c03e5ba9150f7eaed707eb0ede59aa))

### Bug Fixes

- **loading:** Show OS-specific hints for file permission and lock errors by @lyestarzalt([832649b](https://github.com/lyestarzalt/x-dispatch/commit/832649b12f6533720e85fe669d721ef9129789ab))
- **taxi-route:** Fix stale graph closure and enable click mode on activate by @lyestarzalt([67a4e48](https://github.com/lyestarzalt/x-dispatch/commit/67a4e4866af28c1fa60f6161cb45bd3b689fead2))
- **taxi-graph:** Include runway edges with penalty, filter to connected nodes by @lyestarzalt([8d0e150](https://github.com/lyestarzalt/x-dispatch/commit/8d0e1506938623b91670ace462f75827aae70b5c))
- **taxi-route:** Improve route line rendering by @lyestarzalt([334a206](https://github.com/lyestarzalt/x-dispatch/commit/334a2060c4f9f946aa67c1c12f270801f8a89493))
- **taxi-route:** Integrate panel into gate card and fix preview colors by @lyestarzalt([694581b](https://github.com/lyestarzalt/x-dispatch/commit/694581bb0540d5921d4d46436ed0fcb78d2bec62))
- **taxi-route:** Integrate controls into gate card, unwrap route summary, add i18n by @lyestarzalt([49eff58](https://github.com/lyestarzalt/x-dispatch/commit/49eff588d9a8b3eb43ee7db1bec00a2ba184bd70))
- **taxi-route:** Fix Select uncontrolled-to-controlled warning by @lyestarzalt([00bd947](https://github.com/lyestarzalt/x-dispatch/commit/00bd9476c5039385d2e41681bda57b37cc657f37))
- **map:** Fix airport switching black screen caused by animation blocking isStyleLoaded by @lyestarzalt([46055ad](https://github.com/lyestarzalt/x-dispatch/commit/46055addfd6b4c1c4f538e45603bac0d026a160f))
- **map:** Remove taxiway light animation entirely (fixes #59) by @lyestarzalt([101d1b8](https://github.com/lyestarzalt/x-dispatch/commit/101d1b8322977aaf73846c97b64bc7c7ea224b51))
- **launch:** Add scroll-snap to livery grid for row-by-row scrolling by @lyestarzalt([0a0e8ef](https://github.com/lyestarzalt/x-dispatch/commit/0a0e8ef12ba31289b8c4fbc58deaec31e1ca2c80))
- **settings:** Remove day/night and contour toggles, fix migration by @lyestarzalt([6e0ea5c](https://github.com/lyestarzalt/x-dispatch/commit/6e0ea5c300b4e0579fb3a894f83342c666068d25))
- **debug:** Remove misleading FPS counter from debug overlay by @lyestarzalt([c6e1ccf](https://github.com/lyestarzalt/x-dispatch/commit/c6e1ccf12ada9c6dceb65df370bd1e5848054ee5))
- **taxi-route:** Remove backtracking loops from resolved path by @lyestarzalt([51718a5](https://github.com/lyestarzalt/x-dispatch/commit/51718a5e2a017fe854f51cbbbb007035d206fd6e))
- **taxi-route:** Compute taxiway names and distance from graph edges by @lyestarzalt([c69551a](https://github.com/lyestarzalt/x-dispatch/commit/c69551a76f1becb3a3ad6de82ce8a40e78e1770e))
- **nav:** Fix nav layers disappearing after airport switch by @lyestarzalt([7dcd2cb](https://github.com/lyestarzalt/x-dispatch/commit/7dcd2cb90843d5db9599bb10d6445af49377dca9))
- Exclude test files from tsconfig to avoid top-level await errors by @lyestarzalt([d984e0f](https://github.com/lyestarzalt/x-dispatch/commit/d984e0ff30d8139fa8ea6f870c6211cf0984ec5d))
- **lint:** Ignore design-system directory in eslint config by @lyestarzalt([113410b](https://github.com/lyestarzalt/x-dispatch/commit/113410b8091d5b9c9d97b90f133a203f6f6de6c3))
- **test:** Update chunk count after adding 10 more airport fixtures by @lyestarzalt([11abda9](https://github.com/lyestarzalt/x-dispatch/commit/11abda98dd33af65efa3c84a5c3dd79e29c426d6))
- **settings:** Add page header, Discord link, and fix Ko-fi label in Support tab by @lyestarzalt([59986fc](https://github.com/lyestarzalt/x-dispatch/commit/59986fc12423b3a963ac3a1ca0623963bfa193b3))

### Performance

- **taxi-route:** Stop RAF loop when no route animation needed by @lyestarzalt([537fd4d](https://github.com/lyestarzalt/x-dispatch/commit/537fd4d0ed0d353b1b82c281b51b674d28013041))
- **map:** Throttle taxiway light animation to ~10fps (fixes #59) by @lyestarzalt([28d10e2](https://github.com/lyestarzalt/x-dispatch/commit/28d10e255733ba7bb26d27682efb450378afe916))
- **map:** Disable approach light animation and idle orbit (#59) by @lyestarzalt([7b92efd](https://github.com/lyestarzalt/x-dispatch/commit/7b92efdeeb7e17f71287729a4e04d8d94b18fc1d))

### Refactor

- **map:** Use renderer metadata for clearAirport instead of string prefix by @lyestarzalt([2d90dca](https://github.com/lyestarzalt/x-dispatch/commit/2d90dca33e29a86e771b8146789d43e66c307f82))
- **settings:** Move privacy and report issue to Support tab by @lyestarzalt([b75724d](https://github.com/lyestarzalt/x-dispatch/commit/b75724d3b9864f3d698a9979e9c9d6f25acb06b1))

### Documentation

- Update CHANGELOG.md for v1.6.1 by @github-actions[bot]([50633a9](https://github.com/lyestarzalt/x-dispatch/commit/50633a91922e949e27f44cd786aedfcfb1d458ba))
- **map:** Document airport switching fix — why safeRemove is bypassed by @lyestarzalt([2e44470](https://github.com/lyestarzalt/x-dispatch/commit/2e44470ac7214cd26e34b6eff3ae797e9be3355d))
- Add donation section to README by @lyestarzalt([e1b4153](https://github.com/lyestarzalt/x-dispatch/commit/e1b41532e3b3fd552cf2e6dbbf56edc97fc1e944))
- Trim README, link to project page for full details by @lyestarzalt([6cd8f28](https://github.com/lyestarzalt/x-dispatch/commit/6cd8f289a07d8d3681c03243736b10961b1666f8))

### Miscellaneous

- **map:** Expose map instance on window.__map in dev mode by @lyestarzalt([9563b21](https://github.com/lyestarzalt/x-dispatch/commit/9563b218ff84cbdee63c5437c30eb21cf3026bda))
- Add .agents/ to gitignore by @lyestarzalt([75bc612](https://github.com/lyestarzalt/x-dispatch/commit/75bc6124ab1abfc1031aef17fc9ccb32c16c23cf))
- Add vitest with config and test scripts by @lyestarzalt([a8ba2b1](https://github.com/lyestarzalt/x-dispatch/commit/a8ba2b10c33eef0865063eb607b4b48a639c4b81))
- Remove one-time fixture extraction script by @lyestarzalt([e27b4f2](https://github.com/lyestarzalt/x-dispatch/commit/e27b4f24c491d3bb6638aa64aceb3c12408986f0))
- **sentry:** Migrate to permanent project and upgrade packages by @lyestarzalt([df0353b](https://github.com/lyestarzalt/x-dispatch/commit/df0353b76926a4834b9463ed2263b6f02898a6a3))
- Replace issue templates with YAML forms and add config by @lyestarzalt([ef54dc1](https://github.com/lyestarzalt/x-dispatch/commit/ef54dc1824d74ae905b2d02efb77934ccaab3591))

### Release

- 1.7.0 by @github-actions[bot]([b0c10b6](https://github.com/lyestarzalt/x-dispatch/commit/b0c10b6db33f64c0600d6bcf6b93a2c716fd0f00))

### Test

- Add X-Plane data fixtures for parser tests by @lyestarzalt([5f5ac0f](https://github.com/lyestarzalt/x-dispatch/commit/5f5ac0f099c079fe21ba9c23edab7b6a4a86f37f))
- **parsers:** Add airport parser tests with real apt.dat fixtures by @lyestarzalt([5dd6983](https://github.com/lyestarzalt/x-dispatch/commit/5dd69836610fae6acd018fb692f2d110c45e3cde))
- **parsers:** Add navaid parser tests by @lyestarzalt([df2c702](https://github.com/lyestarzalt/x-dispatch/commit/df2c7021ef04099e5d84638fb678ce38f730dc33))
- **parsers:** Add waypoint, airway, and airspace parser tests by @lyestarzalt([61a79b2](https://github.com/lyestarzalt/x-dispatch/commit/61a79b2792cd30556748581040bc7dab73fe0535))
- Add in-memory DB test helper with Drizzle migrations by @lyestarzalt([7a6628a](https://github.com/lyestarzalt/x-dispatch/commit/7a6628a6516e27fb00f0550c0eea278228899eb8))
- **db:** Add schema and migration tests by @lyestarzalt([b9b34ee](https://github.com/lyestarzalt/x-dispatch/commit/b9b34eeb69578be413625e59fd7abee1b767cebb))
- **db:** Add airport cache pipeline tests by @lyestarzalt([4ae0f2c](https://github.com/lyestarzalt/x-dispatch/commit/4ae0f2c436e8342e6d26c4879dcca385a08cedcf))
- **db:** Add nav data cache pipeline tests by @lyestarzalt([2c40397](https://github.com/lyestarzalt/x-dispatch/commit/2c40397d490b33af5caf0fe50422e8efe24afed7))
- **cache:** Add cache invalidation tests by @lyestarzalt([11128e5](https://github.com/lyestarzalt/x-dispatch/commit/11128e5799a72b61556d320bea59e3209c8fdf6c))
- **db:** Add custom scenery airport cache tests by @lyestarzalt([b6f11ff](https://github.com/lyestarzalt/x-dispatch/commit/b6f11ff8caddcda2d3ff3b57784f6274bbf18da7))
- Add 10 more airport fixtures covering heliports, seaplanes, and grass strips by @lyestarzalt([f1b5ffb](https://github.com/lyestarzalt/x-dispatch/commit/f1b5ffb8a45a76d06949e9cc669eb731c2e4a476))
- **parsers:** Add structural fingerprint regression tests for 15 airports by @lyestarzalt([6ed08ca](https://github.com/lyestarzalt/x-dispatch/commit/6ed08caf2c7a3edafe0cffcc1a63d99b6d904749))
- **parsers:** Add bezier, runway geometry, and path parser unit tests by @lyestarzalt([de9f1e6](https://github.com/lyestarzalt/x-dispatch/commit/de9f1e6566f5771d87dcac30a53d1eaa38abce6e))


## v1.6.1 - 2026-04-16

### Features

- **debug:** Add layer inspector, draggable overlay, glassmorphism UI by @lyestarzalt([0b37278](https://github.com/lyestarzalt/x-dispatch/commit/0b372782356bf9e594902d2d4a7248d13f5855d7))
- **debug:** Show layer draw order in inspector by @lyestarzalt([6aeb922](https://github.com/lyestarzalt/x-dispatch/commit/6aeb922f78869cd3fc0270551bff27ad4972c9d8))
- **debug:** Detachable panels, layer toggle, prominent draw order by @lyestarzalt([5cd280b](https://github.com/lyestarzalt/x-dispatch/commit/5cd280b94dd9fd61eeaa496659da506cdabbecb9))
- **debug:** Tabbed toolbar with detachable panels, state inspector by @lyestarzalt([560a076](https://github.com/lyestarzalt/x-dispatch/commit/560a0766b92cee4ab17945d5c101f8c6baa00355))
- **debug:** Add file paths section to debug overlay Map tab by @lyestarzalt([1772e5a](https://github.com/lyestarzalt/x-dispatch/commit/1772e5adadb20fde113623bee4442187af4fd40d))
- **settings:** Add customLaunchArgs to launcher settings by @lyestarzalt([c5daa63](https://github.com/lyestarzalt/x-dispatch/commit/c5daa63a14514c325c44d61e33fa2b51a7595963))
- **config:** Add X-Plane CLI arg catalog by @lyestarzalt([fee7db0](https://github.com/lyestarzalt/x-dispatch/commit/fee7db0a947449c9a2991ad381870ced6c5c7b1b))
- **settings:** Add LaunchArgsCard component by @lyestarzalt([9943567](https://github.com/lyestarzalt/x-dispatch/commit/994356733e39945e086aa56702fb6c97a492afbf))
- **settings:** Add launch args card to X-Plane section by @lyestarzalt([a21ec6b](https://github.com/lyestarzalt/x-dispatch/commit/a21ec6b0f2a97ee6b1681b22c02a3ec5b8cf5e5e))
- **launch:** Send custom launch args on cold start by @lyestarzalt([b2953ca](https://github.com/lyestarzalt/x-dispatch/commit/b2953ca59128879af35e35e7b32fad0b82410179))
- **ci:** Replace deb/rpm with AppImage and add arm64 Linux builds by @lyestarzalt([b88bed9](https://github.com/lyestarzalt/x-dispatch/commit/b88bed99d7976c470f208fccabcca58669f504cb))
- **ci:** Auto-increment RC number from existing artifacts by @lyestarzalt([1bd653e](https://github.com/lyestarzalt/x-dispatch/commit/1bd653e89cbd2a643c1ee639721d2f69b8d55fde))
- **debug:** Refactor DevDebugOverlay into folder, add DB panel and settings toggle by @lyestarzalt([8b41b5f](https://github.com/lyestarzalt/x-dispatch/commit/8b41b5f393400024bcfa9ee378562dc5f1437d4f))
- **taxi-route:** Click-to-add taxi route with canvas overlay by @Pwoodlock([6d67450](https://github.com/lyestarzalt/x-dispatch/commit/6d67450f07b83e820f8523f7560b409d4827ea3c))

### Bug Fixes

- **debug:** Center detached panels, bold ON/OFF toggle buttons by @lyestarzalt([807a81b](https://github.com/lyestarzalt/x-dispatch/commit/807a81b2b66910070eeccb5d3e62eb23943f7f38))
- **ui:** Group airport filters under one section and fix hardcoded strings by @lyestarzalt([3f71a2a](https://github.com/lyestarzalt/x-dispatch/commit/3f71a2afea46eb75275078c0ae5f63dc8333ecfb))
- **map:** Improve taxiway lights with 3-layer glow and add @types/three by @lyestarzalt([5b7fbbd](https://github.com/lyestarzalt/x-dispatch/commit/5b7fbbd299663480e5ac95eca202897a3053128c))
- **scenery:** Preserve absolute paths and make analyze() read-only (#49) by @lyestarzalt([fa3f1d5](https://github.com/lyestarzalt/x-dispatch/commit/fa3f1d50123c29695035f0c54af6d3f9cd53b28d))
- **settings:** Add i18n and improve launch args chip styling by @lyestarzalt([9d25c60](https://github.com/lyestarzalt/x-dispatch/commit/9d25c605da14f9ebd3d7199a0f15009b0ac76728))
- **settings:** Fix scroll in launch args dropdown and add i18n by @lyestarzalt([d6abb36](https://github.com/lyestarzalt/x-dispatch/commit/d6abb36e2105a80ced7fff9ac2089912670458a9))
- **ui:** Override Radix ScrollArea table display to prevent content clipping by @lyestarzalt([d2fd6f4](https://github.com/lyestarzalt/x-dispatch/commit/d2fd6f4863b4d68a2357ec4963295464ca522e92))
- **db:** Auto-delete corrupt database and relaunch on migration failure by @lyestarzalt([6a3cba6](https://github.com/lyestarzalt/x-dispatch/commit/6a3cba617c95e03a04b17b0869dbddcba4929c6c))
- **taxi-route:** Clean up PR #58 to match project conventions by @lyestarzalt([e647869](https://github.com/lyestarzalt/x-dispatch/commit/e6478693d1b44a59113be4be8fcb0cee1754c43f))

### Refactor

- **debug:** Replace floating overlay with tabbed toolbar by @lyestarzalt([644c36b](https://github.com/lyestarzalt/x-dispatch/commit/644c36ba6fd46f2567bd8232de8b085a453866e5))
- Enable noUncheckedIndexedAccess and fix all 388 errors by @lyestarzalt([7f6d11c](https://github.com/lyestarzalt/x-dispatch/commit/7f6d11cd79f28281fd34f612e6fd2933d5d8d803))
- Enable noUnusedLocals and remove dead code across 28 files by @lyestarzalt([6925fd8](https://github.com/lyestarzalt/x-dispatch/commit/6925fd849dba9499e1f128a22c48b18e722fdf2e))
- **logging:** Extract startup logs to startupLog.ts and add GPU/display diagnostics by @lyestarzalt([b8abe57](https://github.com/lyestarzalt/x-dispatch/commit/b8abe57f62026bec237d432117c25673aeac5a09))

### Documentation

- Update CHANGELOG.md for v1.6.0 by @github-actions[bot]([eaeff41](https://github.com/lyestarzalt/x-dispatch/commit/eaeff41d85603a3d09f3affb1d812fb986e06ae2))
- Update README with recent features and expanded dev section by @lyestarzalt([7f3340c](https://github.com/lyestarzalt/x-dispatch/commit/7f3340cbdcdb5b30e4c02b1c80c4e9e74bed8536))
- Fix X-Plane version, show 3D terrain screenshot, trim dev section by @lyestarzalt([cad5be7](https://github.com/lyestarzalt/x-dispatch/commit/cad5be718581039f20ca8eb7ce6c542fadfc6493))
- Add hits badge to README by @lyestarzalt([eda737f](https://github.com/lyestarzalt/x-dispatch/commit/eda737fda854c1cfa4317853f8a8eb92c82d125d))
- Update README hero and Discord invite link by @lyestarzalt([b47f09f](https://github.com/lyestarzalt/x-dispatch/commit/b47f09f631797af86a768694b232e4e4714c027b))
- Clean up and reword README by @lyestarzalt([2f748d7](https://github.com/lyestarzalt/x-dispatch/commit/2f748d792fc30487788816060a4ae6de5a3c3ebe))
- Add install troubleshooting for Windows and macOS by @lyestarzalt([e042047](https://github.com/lyestarzalt/x-dispatch/commit/e042047dc6fdac1853c8a37ee9d0a8923419465c))

### Miscellaneous

- Remove CLAUDE.md from tracking by @lyestarzalt([691fa05](https://github.com/lyestarzalt/x-dispatch/commit/691fa058950512c671a1e206f04947c0238765b4))
- Address high vulnerabilities by @necromeo([afc0f71](https://github.com/lyestarzalt/x-dispatch/commit/afc0f710b59537daf5f52b18fc38397bba9cde08))

### Release

- 1.6.1 by @github-actions[bot]([3fafbe0](https://github.com/lyestarzalt/x-dispatch/commit/3fafbe003ba79a1d4a66a276e2ac14962534c17b))



### New Contributors

- @Pwoodlock made their first contribution
- @necromeo made their first contribution
## v1.6.0 - 2026-03-24

### Features

- **ui:** Auto-navigate to start tab and scroll to selected item by @lyestarzalt([59391d8](https://github.com/lyestarzalt/x-dispatch/commit/59391d82098d5b9d7d56c20673b5e80722e7f457))
- **launch:** Add runway start options — approach distance and glider tow by @lyestarzalt([cb15a61](https://github.com/lyestarzalt/x-dispatch/commit/cb15a61d6fe04c5598c9ab7a87ff8c0d31e0ae6a))
- **launch:** Add air start, carrier, and frigate start modes to pin drop by @lyestarzalt([6ca0112](https://github.com/lyestarzalt/x-dispatch/commit/6ca0112b3637b52525b9f0366c88280965e3a2be))

### Bug Fixes

- **launch:** Persist aircraft selection under actual type, not just active filter by @lyestarzalt([5067aa7](https://github.com/lyestarzalt/x-dispatch/commit/5067aa7f45706deb9104469c7c77a55ed7717d01))
- **map:** Rewrite taxiway lights as MapLibre circles and fix layer crash by @lyestarzalt([b0fa7c0](https://github.com/lyestarzalt/x-dispatch/commit/b0fa7c071a0104caf549f7180ea4e1f86026588a))
- **addons:** Follow symlinks and junctions when scanning aircraft, plugins, and liveries by @lyestarzalt([0c1593e](https://github.com/lyestarzalt/x-dispatch/commit/0c1593e86a2535c56ba871510fe1182c93edd3e4))
- **data:** Don't abort scenery scan when one symlink fails by @lyestarzalt([e7e0d2b](https://github.com/lyestarzalt/x-dispatch/commit/e7e0d2b5f4b0a2277e60f7ade02d3db01157e7dd))
- **ci:** Add download links to release and changelog to RC Discord notifications by @lyestarzalt([9ae1ded](https://github.com/lyestarzalt/x-dispatch/commit/9ae1dede9459bfb9fcfa3dd25bc7ff4e7ff80a39))
- **map:** Smaller taxiway lights with radiated glow effect by @lyestarzalt([797d922](https://github.com/lyestarzalt/x-dispatch/commit/797d922a8ae8d0c1c804db3d921510659d8e0c3f))

### Refactor

- **explore:** Rework panel as collapsible side panel by @lyestarzalt([16824cc](https://github.com/lyestarzalt/x-dispatch/commit/16824ccdd040ed1bcedc1084b6bd46fe9b6ac572))
- **explore:** Fix event list clipping and unify ICAO colors by @lyestarzalt([9eedad5](https://github.com/lyestarzalt/x-dispatch/commit/9eedad5211c7fa6a1ef8df5ad7289396e8db8700))
- **map:** Redesign runway end markers to match gate visual style by @lyestarzalt([c0cf5a2](https://github.com/lyestarzalt/x-dispatch/commit/c0cf5a2c6621f87052d5e466465c98ac14e1ad6d))

### Documentation

- Update CHANGELOG.md for v1.5.5 by @github-actions[bot]([030dcab](https://github.com/lyestarzalt/x-dispatch/commit/030dcabc4504199ac0dc238d4db413f863dbfaf4))

### Miscellaneous

- Fix dependency vulnerabilities via npm audit fix by @lyestarzalt([f8672ae](https://github.com/lyestarzalt/x-dispatch/commit/f8672ae5949a44e76a18ecd168b2bae054e02b1a))
- **i18n:** Add runway start option translations for all locales by @lyestarzalt([3b0e075](https://github.com/lyestarzalt/x-dispatch/commit/3b0e07548f25742bd6991a350a26fbfb342faebc))
- **ci:** Standardize job and step naming across release workflows by @lyestarzalt([80ea170](https://github.com/lyestarzalt/x-dispatch/commit/80ea17048c982614055605c0fe546fd364aaf315))

### Release

- 1.6.0 by @github-actions[bot]([249c754](https://github.com/lyestarzalt/x-dispatch/commit/249c75485ce682f6870600b491ea0a454a454adc))


## v1.5.5 - 2026-03-22

### Documentation

- Update CHANGELOG.md for v1.5.4 by @github-actions[bot]([7ad9e76](https://github.com/lyestarzalt/x-dispatch/commit/7ad9e76b0205d157557c3e20ebe81a0c44899f9b))

### CI/CD

- Rewrite release workflow and changelog config by @lyestarzalt([5db7eca](https://github.com/lyestarzalt/x-dispatch/commit/5db7eca9094b1706f34b483bed620fe60c2bea9d))
- Skip redundant Sentry source map uploads on non-Linux builds by @lyestarzalt([0d63d20](https://github.com/lyestarzalt/x-dispatch/commit/0d63d203b695fe00f7e7184e80d9acafa3c0df37))

### Release

- 1.5.5 by @github-actions[bot]([7511556](https://github.com/lyestarzalt/x-dispatch/commit/7511556ca4c0ea4e762cd578a8da669e0f1f7117))


## v1.5.4 - 2026-03-22

### Features

- **toolbar:** Add coordinate input to pin drop with split button by @lyestarzalt([ce4845a](https://github.com/lyestarzalt/x-dispatch/commit/ce4845a9046ff447f434171381d7f641f558de85))
- **addons:** Add rescan button to scenery and browser tabs by @lyestarzalt([221576c](https://github.com/lyestarzalt/x-dispatch/commit/221576cf0fca20532a32cbbeeff4042db6d65f61))
- **addons:** Detect manually added scenery and show rescan feedback by @lyestarzalt([e907688](https://github.com/lyestarzalt/x-dispatch/commit/e907688f175f52f8a36817c541816af89ad0a281))
- **map:** Interactive drag-to-resize range rings by @lyestarzalt([16482d3](https://github.com/lyestarzalt/x-dispatch/commit/16482d3d9d09da099c994211396315e53e518827))
- **toolbar:** Add Ctrl+F / Cmd+F shortcut to focus airport search by @lyestarzalt([b894d86](https://github.com/lyestarzalt/x-dispatch/commit/b894d86938bee7e16a10fbae6bd5964ab339b838))
- **addons:** Show GLOBAL_AIRPORTS as draggable row with search bar by @lyestarzalt([f31faaf](https://github.com/lyestarzalt/x-dispatch/commit/f31faaf15fcd0cf01cf62d6d4669aac3cf4f788b))
- **addons:** Add delete scenery from disk with confirmation by @lyestarzalt([22d2978](https://github.com/lyestarzalt/x-dispatch/commit/22d29785917e80947f3660a530a7457134a20683))
- **app:** Add xdispatch:// deep link protocol for airport navigation by @lyestarzalt([0e816e1](https://github.com/lyestarzalt/x-dispatch/commit/0e816e18e8acdb24ab18a3726aeaac38e59e7456))
- **data:** Split airports into two tables for fast custom scenery resync by @lyestarzalt([5a64c1d](https://github.com/lyestarzalt/x-dispatch/commit/5a64c1dbf774552b0ae08572d8b42ada8162d97c))
- **map:** Add starfield background behind globe view by @lyestarzalt([923d4c5](https://github.com/lyestarzalt/x-dispatch/commit/923d4c5e590c2edccfe1e2933adf29b33c7ceec5))

### Bug Fixes

- **ci:** Fix release notes not appearing on GitHub releases by @lyestarzalt([7970a79](https://github.com/lyestarzalt/x-dispatch/commit/7970a79bd358f6bd9515ec1697f15663862aee80))
- **ci:** Use file-based release notes and harden workflow by @lyestarzalt([458d893](https://github.com/lyestarzalt/x-dispatch/commit/458d893b0d66053c7ad4f80bbae77aea76e58990))
- **addons:** Handle cross-drive install when temp and X-Plane are on different drives by @lyestarzalt([450713a](https://github.com/lyestarzalt/x-dispatch/commit/450713a7d8c27a4d4147e2a22d47cbbff6391f70))
- **addons:** Skip deleted scenery folders instead of showing ??? by @lyestarzalt([f10a48e](https://github.com/lyestarzalt/x-dispatch/commit/f10a48ecc073619b2cfb9d29d5b84e4e106e4a8a))
- **addons:** Remove stale scenery entries from scenery_packs.ini by @lyestarzalt([083d1b7](https://github.com/lyestarzalt/x-dispatch/commit/083d1b714e739560fd73c552549bf48004755683))
- **addons:** Fix drag-and-drop not working in installer by @lyestarzalt([6174347](https://github.com/lyestarzalt/x-dispatch/commit/617434701e37f1d9d9161d32a3e43167def5cdfc))
- **addons:** Sort new scenery into correct priority position in INI by @lyestarzalt([c4a045d](https://github.com/lyestarzalt/x-dispatch/commit/c4a045d5551a6d0394ea65055858ae3a783a338a))
- **app:** Prevent multiple instances from running simultaneously by @lyestarzalt([e47a4ea](https://github.com/lyestarzalt/x-dispatch/commit/e47a4eaf2bf04f49713ed42b513ea916fac3ca13))
- **addons:** Fix landmarks misclassified as Airport by @lyestarzalt([8b1e078](https://github.com/lyestarzalt/x-dispatch/commit/8b1e07898a849e9a7ebff1ed561c4287ebd270ee))
- **flightplan:** Clear old route and re-center when loading new file by @lyestarzalt([3c667dd](https://github.com/lyestarzalt/x-dispatch/commit/3c667ddda8bba210fa75d66a8ee7ff4fdafb5791))
- **ui:** Move flight plan close button to the left side by @lyestarzalt([afe8ddc](https://github.com/lyestarzalt/x-dispatch/commit/afe8ddc5dca7c27dff4e54ab9340fc5d76f99f5d))
- **addons:** Fix rescan spinner and add missing i18n keys by @lyestarzalt([a0bf9ac](https://github.com/lyestarzalt/x-dispatch/commit/a0bf9acfca68565be29517716949a48739a47f3f))

### Refactor

- **addons:** Simplify scenery toolbar, remove safe mode toggle by @lyestarzalt([a60a9f5](https://github.com/lyestarzalt/x-dispatch/commit/a60a9f5ee52b75142b6eb0db0a58226682a010d3))
- **map:** Redesign range rings with inline labels along the ring by @lyestarzalt([cc81fa0](https://github.com/lyestarzalt/x-dispatch/commit/cc81fa0613b6d18aebe13ce5083449ac2fc27ff0))
- **map:** Redesign custom airport pin to match design system by @lyestarzalt([258ad9e](https://github.com/lyestarzalt/x-dispatch/commit/258ad9e7dd189140eb1e4f0ed8fc1ee2d86b43ae))
- **addons:** Polish scenery tab UI for consistency by @lyestarzalt([7a327f5](https://github.com/lyestarzalt/x-dispatch/commit/7a327f5b65c07e226b504e7870aa84f31b9e75a2))
- **addons:** Align browser tab toolbar with scenery tab design by @lyestarzalt([66c1349](https://github.com/lyestarzalt/x-dispatch/commit/66c134950c5c574e489c41c6dcc11e5280568886))
- **addons:** Remove check updates button and clean up browser tab by @lyestarzalt([b78fddb](https://github.com/lyestarzalt/x-dispatch/commit/b78fddb895705c463c7f800682a671730305b2dd))

### Documentation

- Update CHANGELOG.md for v1.5.3 by @github-actions[bot]([71a35f6](https://github.com/lyestarzalt/x-dispatch/commit/71a35f642d38cc74a7678bdca1eeba6714ca048e))
- Update README screenshots and add fuel, weather, terrain views by @lyestarzalt([b1ba519](https://github.com/lyestarzalt/x-dispatch/commit/b1ba51934346b39c6b4e102f801c1aaa879c4b34))

### Release

- 1.5.4 by @github-actions[bot]([e7e5ed0](https://github.com/lyestarzalt/x-dispatch/commit/e7e5ed09a8d4df7f133cacd53f3b87221b985f42))


## v1.5.3 - 2026-03-18

### Features

- **launch:** Remember last livery per aircraft by @lyestarzalt([8068db2](https://github.com/lyestarzalt/x-dispatch/commit/8068db21640cc9f70aff5015b072bce3cf0a87e2))
- **ci:** Add version bump and Discord notification to RC workflow by @lyestarzalt([5f671e8](https://github.com/lyestarzalt/x-dispatch/commit/5f671e8c3b386cd78a539f19d19bfce1bb80c2c6))
- **settings:** Add interface zoom control and fix launch dialog layout by @lyestarzalt([35cc049](https://github.com/lyestarzalt/x-dispatch/commit/35cc04932e76991f20c332174dd1bd69da561799))
- **launch:** Remember last aircraft per type filter and improve star visibility by @lyestarzalt([5668558](https://github.com/lyestarzalt/x-dispatch/commit/5668558e141fdea5f8090578c9d1e763cc02fe5a))

### Bug Fixes

- **tileCache:** Remove fake DEM tile fallback that warped terrain by @lyestarzalt([0d141dc](https://github.com/lyestarzalt/x-dispatch/commit/0d141dcb7bb565be224695f4260ff15995ae1d40))
- **flightplan:** Open dialog defaults to current install FMS plans folder by @lyestarzalt([e30b32a](https://github.com/lyestarzalt/x-dispatch/commit/e30b32ad649baca2de470c5aa6cbe959c1c13835))
- **map:** Prevent terrain errors on style change and low zoom by @lyestarzalt([bf8db7b](https://github.com/lyestarzalt/x-dispatch/commit/bf8db7b99a2d7602f7fa1a2126d9626b7b3033c6))
- **map:** Remove minzoom from DEM sources that broke terrain mesh by @lyestarzalt([dddcbfa](https://github.com/lyestarzalt/x-dispatch/commit/dddcbfa5813c1ecce0cdb1fc47f244aa7aa2939a))
- **layout:** Add min-w-0 to addon manager content area by @lyestarzalt([f29d977](https://github.com/lyestarzalt/x-dispatch/commit/f29d977fd2540945142c10be06494b1a1dae61aa))
- **map:** Replace style.load race condition with getStyle guard by @lyestarzalt([c0332f7](https://github.com/lyestarzalt/x-dispatch/commit/c0332f7d89f931af1813a65845d24c5d10b8097e))

### Refactor

- **map:** Use transformStyle to preserve layers across basemap switches by @lyestarzalt([a0a4f9a](https://github.com/lyestarzalt/x-dispatch/commit/a0a4f9a68dd2501c307aa255712ad54788a9f7ab))

### Documentation

- Update CHANGELOG.md for v1.5.2 by @github-actions[bot]([cd1fcac](https://github.com/lyestarzalt/x-dispatch/commit/cd1fcac84f3302548cc0115878cd59cba8314a92))
- Rewrite README with complete feature inventory by @lyestarzalt([618796d](https://github.com/lyestarzalt/x-dispatch/commit/618796dadb1b5fa70efb760d2449fb2851b0ca4b))

### Release

- 1.5.3 by @github-actions[bot]([55cf32a](https://github.com/lyestarzalt/x-dispatch/commit/55cf32a363de8a0b64a8232ba7b52a5ec14aa983))


## v1.5.2 - 2026-03-16

### Features

- **map:** Add setting to toggle idle orbit camera, default off by @lyestarzalt([d48a616](https://github.com/lyestarzalt/x-dispatch/commit/d48a616031a6fc9c6ea8d206de1c769560111466))
- **settings:** Add multi X-Plane installation support by @lyestarzalt([b0aacf3](https://github.com/lyestarzalt/x-dispatch/commit/b0aacf3f50485de556ca8f722e6748748d40b6d1))

### Bug Fixes

- **settings:** Wrap installation name in brackets in window title by @lyestarzalt([e953904](https://github.com/lyestarzalt/x-dispatch/commit/e95390435abbdb65e2ae85059dcaf6ed5326295c))
- **map:** Prevent terrain disappearing after zoom out, add dev debug overlay by @lyestarzalt([10cc5af](https://github.com/lyestarzalt/x-dispatch/commit/10cc5aff6d044714a6a67206c152c740680239be))
- **queries:** Always rescan addon and aircraft lists on dialog open by @lyestarzalt([68367b2](https://github.com/lyestarzalt/x-dispatch/commit/68367b2a89b8ae7d46bd602cb43852586a1de4e7))

### Documentation

- Update CHANGELOG.md for v1.5.1 by @github-actions[bot]([567e58f](https://github.com/lyestarzalt/x-dispatch/commit/567e58f5d95fb80b2f25ba0b21d504c2465a0329))

### Release

- 1.5.2 by @github-actions[bot]([c0cb905](https://github.com/lyestarzalt/x-dispatch/commit/c0cb905f55ff40ef5ac84f7d8ba96ae563ca115f))


## v1.5.1 - 2026-03-15

### Features

- **start-position:** Toggle deselect for gates, runway ends & helipads by @lyestarzalt([33ee35b](https://github.com/lyestarzalt/x-dispatch/commit/33ee35bc5b713631bb3f2add26713f77181fc47c))
- **map:** Add disk tile cache for MapLibre by @lyestarzalt([5f57146](https://github.com/lyestarzalt/x-dispatch/commit/5f57146e0cd681da58b0777f4db3e1416e7b4f6c))
- **map:** Add hillshade and contour lines to terrain visualization by @lyestarzalt([be4e92f](https://github.com/lyestarzalt/x-dispatch/commit/be4e92f05c56269d0a0a5aafe1762acd19ff7d2a))
- **map:** Add idle orbit camera around selected airport by @lyestarzalt([60fa1a3](https://github.com/lyestarzalt/x-dispatch/commit/60fa1a38de27faabfec666410d9ab4f359014b09))
- **map:** Add terrain shading toggle to toolbar overlays by @lyestarzalt([bb03162](https://github.com/lyestarzalt/x-dispatch/commit/bb031621b8197bc1c566b54b725de74f75f4ba26))
- **settings:** Add close-on-launch option, remove networks tab by @lyestarzalt([d61797c](https://github.com/lyestarzalt/x-dispatch/commit/d61797cadff4cb1be840a9584b168461749a1061))
- **window:** Display app version in title bar by @lyestarzalt([24800fa](https://github.com/lyestarzalt/x-dispatch/commit/24800fa4784f8025b617669f74b27ed7f2496468))
- **loading:** Add two-phase loading screen with granular airport progress by @lyestarzalt([e4c48e4](https://github.com/lyestarzalt/x-dispatch/commit/e4c48e4d0d8c4802f5002e705258a893720ae006))
- **data:** Detect symlinked scenery packs in Custom Scenery folder by @lyestarzalt([9406d66](https://github.com/lyestarzalt/x-dispatch/commit/9406d66dc71a3ac638417617ac756011875ad743))
- **branding:** Redesign app icon and inline SVG logo component by @lyestarzalt([dda765a](https://github.com/lyestarzalt/x-dispatch/commit/dda765a1a1a3d9a57ca58b1b70ac25cfcc959ea3))

### Bug Fixes

- **ci:** Include arch in Windows and Linux binary names by @lyestarzalt([31061ef](https://github.com/lyestarzalt/x-dispatch/commit/31061efb091a93fc360ac4414946a344f6f1dd09))
- **data:** Validate airport cache on startup before marking as loaded by @lyestarzalt([ae644d1](https://github.com/lyestarzalt/x-dispatch/commit/ae644d12475faa062fe6be2d0ab631683708e4c9))
- **launch:** Place fuel in correct X-Plane tank slot for third-party aircraft by @lyestarzalt([8041fc0](https://github.com/lyestarzalt/x-dispatch/commit/8041fc00699360df2c535da9df8fadb6dc99c36c))
- **addons:** Harden scenery detection and improve addon manager UI by @lyestarzalt([b2d18d2](https://github.com/lyestarzalt/x-dispatch/commit/b2d18d22a784dc10491805aa868e1320fcaa22ab))
- **launch:** Exclude AI traffic .acf files from aircraft scanner by @lyestarzalt([d2d6809](https://github.com/lyestarzalt/x-dispatch/commit/d2d680961326d429060d960fea3c364f7b54a39c))
- **addons:** Allow backslash in aircraft folder paths for livery scanning by @lyestarzalt([1587ef9](https://github.com/lyestarzalt/x-dispatch/commit/1587ef9f7675f6b6661a8ee65dc8b5ee3ad9b4ef))
- **map:** Prevent terrain crashes on globe projection and silence DEM errors by @lyestarzalt([eb8e070](https://github.com/lyestarzalt/x-dispatch/commit/eb8e0709bdbe09d080f032b5f1f402d60f68f411))

### Documentation

- Update CHANGELOG.md for v1.5.0 by @github-actions[bot]([d3f585f](https://github.com/lyestarzalt/x-dispatch/commit/d3f585fed037c3de693df689714c037ae1077a5b))
- Update Discord invite link by @lyestarzalt([22e14ff](https://github.com/lyestarzalt/x-dispatch/commit/22e14ff9fd0b136c45377adf0f0b3a35db5236c4))

### Miscellaneous

- **db:** Add dbCredentials to drizzle config for Drizzle Studio by @lyestarzalt([1203801](https://github.com/lyestarzalt/x-dispatch/commit/1203801f7f86d804cdd03976004268f44cd8b747))

### Release

- 1.5.1 by @github-actions[bot]([ba7c9ae](https://github.com/lyestarzalt/x-dispatch/commit/ba7c9ae0541412f7f1287698131af9d5e28af204))

### Wip

- **ils:** Scaffold 3D glide slope visualization (disabled) by @lyestarzalt([b028548](https://github.com/lyestarzalt/x-dispatch/commit/b0285486fb39bf0d895537c2c89582aac75562f4))


## v1.5.0 - 2026-03-12

### Features

- **weather:** Redesign WeatherDialog with interactive altitude diagram by @lyestarzalt([6826eb9](https://github.com/lyestarzalt/x-dispatch/commit/6826eb9e48384bebccd33db2139a72934918b091))
- **weather:** Add environment controls, i18n, and fix dialog sizing by @lyestarzalt([fb2c054](https://github.com/lyestarzalt/x-dispatch/commit/fb2c0549177e15c58e5b7a510fc8590f03548bf1))
- **map:** Add day/night terminator overlay by @lyestarzalt([2ffad99](https://github.com/lyestarzalt/x-dispatch/commit/2ffad99c4caec6b7fabea91766fba0f99982ca01))
- **map:** Add range rings layer for aircraft category reach visualization by @lyestarzalt([72d9f3e](https://github.com/lyestarzalt/x-dispatch/commit/72d9f3e0eedffde65679a6bfe408e1fd66e30985))
- **map:** Add pin-drop custom start location by @lyestarzalt([137a0fc](https://github.com/lyestarzalt/x-dispatch/commit/137a0fc7e1f097f8a60a4de0cf29c6e45a668d15))
- **launcher:** Persist aircraft list filters across sessions by @lyestarzalt([300ad1f](https://github.com/lyestarzalt/x-dispatch/commit/300ad1f198cc4398706d79070f8d42bd910ff41b))
- **map:** Render aircraft silhouettes for VATSIM/IVAO traffic by @lyestarzalt([cf14265](https://github.com/lyestarzalt/x-dispatch/commit/cf142653fe828e8bcd9e9b8d73fc2c36517f070a))
- **map:** Redesign player aircraft icon with canvas-based rendering by @lyestarzalt([403ae66](https://github.com/lyestarzalt/x-dispatch/commit/403ae66394acd13a1754eb4a79bbf2f022283464))
- **xplane:** Detect aircraft category from X-Plane metadata datarefs by @lyestarzalt([af2224a](https://github.com/lyestarzalt/x-dispatch/commit/af2224a52a9edc7f454a062057dd759830480e32))
- **flight-strip:** Redesign with grouped layout, color-coded values, drag-to-reposition & new datarefs by @lyestarzalt([a3b59d1](https://github.com/lyestarzalt/x-dispatch/commit/a3b59d13fe7d706a4314b40e2e5324cbd34095c0))
- **logbook:** Save last 10 launches with browse & restore by @lyestarzalt([0b3c859](https://github.com/lyestarzalt/x-dispatch/commit/0b3c8594ab4c3c73e7ec2be4aa522da6fd0645f9))

### Bug Fixes

- **ui:** Add forwardRef to Badge component by @lyestarzalt([2f1f4cf](https://github.com/lyestarzalt/x-dispatch/commit/2f1f4cf773c86cdc0bf09f6c7d299682d6df7793))
- **ui:** Correct ref types and add missing forwardRef in shadcn components by @lyestarzalt([b29b9fb](https://github.com/lyestarzalt/x-dispatch/commit/b29b9fbc2b6314425cbc5080e05c65192888cff4))
- **launcher:** Derive fuel tank ratios from _cgpt capacity for third-party helicopters by @lyestarzalt([568afaf](https://github.com/lyestarzalt/x-dispatch/commit/568afaf95d9d629625c764127e9ac951f730f734))
- **launcher:** Skip --version on Windows Steam to avoid launch dialog by @lyestarzalt([1223c8f](https://github.com/lyestarzalt/x-dispatch/commit/1223c8f1bba39a8156a4ff45afdee249c9efe6f2))
- **launcher:** Correct fuel tank count for third-party aircraft by @lyestarzalt([993d7c9](https://github.com/lyestarzalt/x-dispatch/commit/993d7c92d70c5390a8ece4c4c105f0a3636e6c70))
- **launcher:** Improve fuel parsing and add payload fallback for third-party aircraft by @lyestarzalt([d833981](https://github.com/lyestarzalt/x-dispatch/commit/d833981e35161ee95708f565b50446f17fe4f199))
- **launcher:** Adjust sun arc horizon line based on day length by @lyestarzalt([fa7fc12](https://github.com/lyestarzalt/x-dispatch/commit/fa7fc12eca3ee5a6c6cbfc6e83122c1fe97b1a7b))
- **launcher:** Persist aircraft path instead of full object to prevent stale livery/config by @lyestarzalt([7db1445](https://github.com/lyestarzalt/x-dispatch/commit/7db1445aa568c33919c0ebc89ac12fbc4500ac1d))
- **map:** Clear selected procedure when flight plan is removed by @lyestarzalt([4adb08d](https://github.com/lyestarzalt/x-dispatch/commit/4adb08d2d17acf80e73f84cea9c5572d82b5ae28))
- **map:** Replace deferred layer removal with synchronous getStyle guard by @lyestarzalt([ddb4116](https://github.com/lyestarzalt/x-dispatch/commit/ddb4116a2bbadde17da9900377d9aecd74fafed4))
- **addons:** Invalidate launcher aircraft cache after addon mutations by @lyestarzalt([60aad9d](https://github.com/lyestarzalt/x-dispatch/commit/60aad9d45fde47ea51f24e32da161f9971e5d312))

### Refactor

- **ui:** Clean up LoadingScreen design system usage and dead code by @lyestarzalt([a25ae6d](https://github.com/lyestarzalt/x-dispatch/commit/a25ae6dfc2140055cc37586a712200f47714627d))
- **ui:** Add categorical color tokens to design system by @lyestarzalt([cc8104d](https://github.com/lyestarzalt/x-dispatch/commit/cc8104df9ee8c0ba611a7e0e06970c439e44184d))
- **ui:** Convert remaining hardcoded colors to design system tokens by @lyestarzalt([320c378](https://github.com/lyestarzalt/x-dispatch/commit/320c378f812d0f34f3a69cb2843b6514eb5b1c31))
- **ui:** Use correct shadcn/ui components for tabs, toggles, and buttons by @lyestarzalt([1fb73a3](https://github.com/lyestarzalt/x-dispatch/commit/1fb73a3af0c3feb9608719cac7d7cf9bb32d0899))
- **ui:** Centralize Badge variants, Button tooltips, and Spinner component by @lyestarzalt([ade11ac](https://github.com/lyestarzalt/x-dispatch/commit/ade11ac4bc5613e00759b6c6a8206aab882e36b1))
- **ui:** Add Input icon slots, improve FlightConfig layout and token usage by @lyestarzalt([d9ebc19](https://github.com/lyestarzalt/x-dispatch/commit/d9ebc19d4fa03048e02c01f4a67dcf28a4020e99))
- **websocket:** Replace ad-hoc reconnect with state machine, backoff & keepalive by @lyestarzalt([6119d6e](https://github.com/lyestarzalt/x-dispatch/commit/6119d6e4068c0104a4e0648d91305c27572d826a))

### Documentation

- Update CHANGELOG.md for v1.4.1 by @github-actions[bot]([9d2d105](https://github.com/lyestarzalt/x-dispatch/commit/9d2d1059c439e66586daabe3126b9340914d6dea))

### Miscellaneous

- **ci:** Add separate mac arm64/x64 builds and rename artifacts by @lyestarzalt([40fd2ac](https://github.com/lyestarzalt/x-dispatch/commit/40fd2ac9e0c8bae646cf5edf28358f379e7a450f))

### Release

- 1.5.0 by @github-actions[bot]([7ab9b2c](https://github.com/lyestarzalt/x-dispatch/commit/7ab9b2c93e41599824cee0de7a14b24407efcc28))


## v1.4.1 - 2026-03-06

### Features

- **map:** Add country and surface type airport filters by @lyestarzalt([66e709f](https://github.com/lyestarzalt/x-dispatch/commit/66e709f81db295d60fa9701e663adf4c3e546c73))
- **data:** Detect and store exact X-Plane version by @lyestarzalt([9c5ec6b](https://github.com/lyestarzalt/x-dispatch/commit/9c5ec6bf45f43aa148f7d0b306d7c2f10b096974))
- **gateway:** Detect and display newer Gateway scenery releases by @lyestarzalt([66c3dbc](https://github.com/lyestarzalt/x-dispatch/commit/66c3dbcaa01561514a0d9ffa25c0d7cc6dabcb77))

### Bug Fixes

- **simbrief:** Prevent empty object rendering in VerticalProfile tooltip by @lyestarzalt([85b7182](https://github.com/lyestarzalt/x-dispatch/commit/85b7182d5c7f1e8e38562591b016fbb69a4ee23b))
- **launcher:** Handle CRLF line endings and missing tank names in ACF parser by @lyestarzalt([8c73b47](https://github.com/lyestarzalt/x-dispatch/commit/8c73b474a910452d7cedfee35a9950bda557c709))
- **addon-manager:** Always detect .acf as aircraft regardless of nesting by @lyestarzalt([acee2ea](https://github.com/lyestarzalt/x-dispatch/commit/acee2ea5ca0d195199bbcf93f728392d7616eafc))
- **addon-manager:** Resolve 7zip binary path and add alpha badge by @lyestarzalt([f95766f](https://github.com/lyestarzalt/x-dispatch/commit/f95766ff6b24178b00db19accf8890abeab60603))
- **launcher:** Switch ramp spawn from lle_ground_start to ramp_start by @lyestarzalt([d45f2f3](https://github.com/lyestarzalt/x-dispatch/commit/d45f2f3795e8fea99a01828351925f7ccf257a08))
- **map:** Update existing sources when switching airports by @lyestarzalt([66b5f6e](https://github.com/lyestarzalt/x-dispatch/commit/66b5f6e9b9bf051679204e4be5e50cb6d1265764))
- **db:** Handle Windows file lock when deleting stale database by @lyestarzalt([6384c0c](https://github.com/lyestarzalt/x-dispatch/commit/6384c0cef01d046f267a6be657e9dcd947589e6c))
- **sentry:** Skip renderer error reporting in development by @lyestarzalt([1572a0f](https://github.com/lyestarzalt/x-dispatch/commit/1572a0f5bdced233d55ac91cf19d1a5644c181fd))

### Documentation

- Update CHANGELOG.md for v1.4.0 by @github-actions[bot]([d926081](https://github.com/lyestarzalt/x-dispatch/commit/d92608148a45b1ba467b0d9257c0f376fe23cbb2))

### Miscellaneous

- **about:** Add Gilles to credits as special thanks for testing by @lyestarzalt([e985061](https://github.com/lyestarzalt/x-dispatch/commit/e985061cd0c9afe05fe5737f2d891f6c070f4c2b))
- Add emojis to README and gitignore design system files by @lyestarzalt([f149241](https://github.com/lyestarzalt/x-dispatch/commit/f149241f496fce8c1843fed88d30884330f9afe0))

### Release

- 1.4.1 by @github-actions[bot]([3374b10](https://github.com/lyestarzalt/x-dispatch/commit/3374b101f88c45fb0bdb230e0a6844b7dec57e50))


## v1.4.0 - 2026-03-03

### Features

- **networks:** Add IVAO online network support with mutual exclusivity by @lyestarzalt([8b4b124](https://github.com/lyestarzalt/x-dispatch/commit/8b4b124b6fca42d35459d711f38dd9ad0f7f1895))
- **launcher:** Add Weight, Balance & Fuel dialog with per-tank fuel and payload stations by @lyestarzalt([37f4290](https://github.com/lyestarzalt/x-dispatch/commit/37f42906bb5b2ed0c8a3039e5f6276c6b8b621a8))
- **launcher:** Add weather customization with presets and custom mode by @lyestarzalt([2c71aad](https://github.com/lyestarzalt/x-dispatch/commit/2c71aad12ae3d63fec2bfdd7baa1569236454ae0))
- **launcher:** Replace SunArc with visual celestial arc component by @lyestarzalt([d375ea9](https://github.com/lyestarzalt/x-dispatch/commit/d375ea9905d125b3d163bc44cf16c67bb97f5114))

### Bug Fixes

- **ivao:** Add null guards for external API data by @lyestarzalt([022600d](https://github.com/lyestarzalt/x-dispatch/commit/022600d2890f945fba17bbd5291a6cdd5ee1b312))

### Refactor

- **launcher:** Clean up FlightConfig sidebar layout by @lyestarzalt([22ca286](https://github.com/lyestarzalt/x-dispatch/commit/22ca2867892ccdf1c9d1caadab6ae1dc383f249e))

### Documentation

- Update CHANGELOG.md for v1.3.2 by @github-actions[bot]([e423c01](https://github.com/lyestarzalt/x-dispatch/commit/e423c017d4c2c7dc781241b549fd83ea9042d217))

### Release

- 1.4.0 by @github-actions[bot]([6232e9c](https://github.com/lyestarzalt/x-dispatch/commit/6232e9c1098cd828699a1a70b68f7d156b31a463))


## v1.3.2 - 2026-03-03

### Bug Fixes

- **map:** Improve MapLibre error logging and SVG icon loading by @lyestarzalt([610d39b](https://github.com/lyestarzalt/x-dispatch/commit/610d39b3690e337dacc1c523f18c6d7e68fdedca))
- **addon-manager:** User-friendly error for EPERM in protected X-Plane folders by @lyestarzalt([cb94a92](https://github.com/lyestarzalt/x-dispatch/commit/cb94a92142dba515358dc157e15820760d2e96c1))
- **simbrief:** Guard against non-string NOTAM and SIGMET fields by @lyestarzalt([618fd1e](https://github.com/lyestarzalt/x-dispatch/commit/618fd1e04971be3c950ea52ae61acd59584be66b))
- **map:** Guard against NaN coordinates in fitMapToFlightPlan by @lyestarzalt([8d39912](https://github.com/lyestarzalt/x-dispatch/commit/8d3991229c3cf8d0b96553a1340076d4abda1a60))
- **launcher:** Preserve unrecognized lines in Freeflight.prf by @lyestarzalt([7b500af](https://github.com/lyestarzalt/x-dispatch/commit/7b500afd17846a4e98e6417932c2aab6e2547d77))
- **addon-manager:** Preserve scenery_packs.ini order and disable by default by @lyestarzalt([588ee1a](https://github.com/lyestarzalt/x-dispatch/commit/588ee1a68728eec7c634327558dca8f86f579d49))
- **compass:** Normalize bearing to 0-360 instead of -180 to 180 by @lyestarzalt([d11594b](https://github.com/lyestarzalt/x-dispatch/commit/d11594ba4feeaf167db1009fef18644039a17fd7))

### Refactor

- **toolbar:** Consolidate 12 items into 7 for narrow-screen support by @lyestarzalt([11de983](https://github.com/lyestarzalt/x-dispatch/commit/11de9839fc7ccb3586116de35dde570c5187632c))
- **launcher:** Use FlightInit JSON for cold start instead of Freeflight.prf by @lyestarzalt([d4d2f67](https://github.com/lyestarzalt/x-dispatch/commit/d4d2f674775cdfaed7d79416ddccaba5c969d285))
- **ui:** Move addon manager from settings to toolbar by @lyestarzalt([a59c67a](https://github.com/lyestarzalt/x-dispatch/commit/a59c67ae01b9331b8ebe0fb7450051f2266fc2b3))
- **addon-manager:** Always show in toolbar and indicate order is preserved by @lyestarzalt([4559f89](https://github.com/lyestarzalt/x-dispatch/commit/4559f895357bee0d242404ad22fe83f10417d9e3))

### Documentation

- Update CHANGELOG.md for v1.3.1 by @github-actions[bot]([ca96d0c](https://github.com/lyestarzalt/x-dispatch/commit/ca96d0c2220590d4ee1b8267d036a63973102f23))

### Miscellaneous

- **deps:** Upgrade maplibre-gl to ^5.19.0 by @lyestarzalt([8ab9a84](https://github.com/lyestarzalt/x-dispatch/commit/8ab9a8454cbf9c135d6ce9ee4c4604ae3ccabcfb))
- **launcher:** Add TODO for --no_save_prefs user settings issue by @lyestarzalt([27820fd](https://github.com/lyestarzalt/x-dispatch/commit/27820fd541d5156d3a397887c5f7ccc2bcc6efe2))
- **launcher:** Add TODO for pgrep false positive on macOS by @lyestarzalt([3d0151f](https://github.com/lyestarzalt/x-dispatch/commit/3d0151fd8b612cad8493dfec14973f6a98587ff0))

### Release

- 1.3.2 by @github-actions[bot]([82bc52b](https://github.com/lyestarzalt/x-dispatch/commit/82bc52b5fa63cc93fdc30caa9c782721e9251fcb))


## v1.3.1 - 2026-03-01

### Bug Fixes

- **map:** Defer layer removal when MapLibre is mid-render by @lyestarzalt([a84d476](https://github.com/lyestarzalt/x-dispatch/commit/a84d476f6a0afb0a8849134540d790c5175a9906))
- **simbrief:** Surface real API error message instead of generic HTTP 400 by @lyestarzalt([d092def](https://github.com/lyestarzalt/x-dispatch/commit/d092defba5d2aa1087659e7f99dd92d15374d14d))
- **map:** Fix taxiway name layer interpolation and visibility by @lyestarzalt([d85b6e3](https://github.com/lyestarzalt/x-dispatch/commit/d85b6e3389b9b80841fcaa7c1937a2f59852aaa4))
- **simbrief:** Sanitize API response to handle empty objects by @lyestarzalt([dc44185](https://github.com/lyestarzalt/x-dispatch/commit/dc441857e82c5175357df4bd2c9ffbd502508dcb))
- Terrain DEM maxzoom and SimBrief array coercion crashes by @lyestarzalt([40a9bc7](https://github.com/lyestarzalt/x-dispatch/commit/40a9bc739f56e085a5e0b5b2016447f75295934d))
- **sentry:** Fix source map uploads and VerticalProfile crash by @lyestarzalt([6a028ad](https://github.com/lyestarzalt/x-dispatch/commit/6a028ad4aeb15e618b032e4869179d8d28cd1657))
- **simbrief:** Tell user to generate a flight plan on simbrief.com first by @lyestarzalt([491ae8d](https://github.com/lyestarzalt/x-dispatch/commit/491ae8d0a2c974984a691975e75ddc293358a127))

### Documentation

- Update CHANGELOG.md for v1.3.0 by @github-actions[bot]([5ba61e0](https://github.com/lyestarzalt/x-dispatch/commit/5ba61e0f79793be546d41b3693d7b6faac746fd2))

### Release

- 1.3.1 by @github-actions[bot]([ed300d0](https://github.com/lyestarzalt/x-dispatch/commit/ed300d01db28e9f786fc6339f922888e4b05a5ef))


## v1.3.0 - 2026-03-01

### Features

- **settings:** Add user-configurable font size (small/medium/large) by @lyestarzalt([ff974a2](https://github.com/lyestarzalt/x-dispatch/commit/ff974a20b0c4f83b5c217b62bf958ae9ac96fc03))
- **launcher:** Persist flight config across sessions by @lyestarzalt([bafac37](https://github.com/lyestarzalt/x-dispatch/commit/bafac37bc34a832557ee864eda96d04e3b061b7c))
- **map:** Add airport dot filters (type, custom scenery) by @lyestarzalt([74a22d7](https://github.com/lyestarzalt/x-dispatch/commit/74a22d70e2b23625a0394141eb8e05d5de32861d))
- **map:** Add taxiway name labels from taxi route network by @lyestarzalt([ad1e075](https://github.com/lyestarzalt/x-dispatch/commit/ad1e0752321aaac89ef0e6d422e4cb38d6d288e4))
- **map:** Add live weather radar overlay using RainViewer API by @lyestarzalt([603ee68](https://github.com/lyestarzalt/x-dispatch/commit/603ee6870b6389caeb1d56276a0abc8a17d82097))

### Bug Fixes

- **ui:** Increase base text size from text-xs to text-sm across all components by @lyestarzalt([23a39e7](https://github.com/lyestarzalt/x-dispatch/commit/23a39e7e632667c4a7942c92fcea961d7f3f4806))
- **db:** Replace broken migration system with schema fingerprinting by @lyestarzalt([fdc3677](https://github.com/lyestarzalt/x-dispatch/commit/fdc36770ed0983db4080faf37021e612a9a40ae1))
- **main:** Retry DB init on failure to prevent zombie app state by @lyestarzalt([604fb2c](https://github.com/lyestarzalt/x-dispatch/commit/604fb2c6372a085a4683a0cf6b6648803743e7ac))
- **db:** Harden startup against all DB failure paths by @lyestarzalt([4bb1e72](https://github.com/lyestarzalt/x-dispatch/commit/4bb1e728444eb5bb633679b9d0ee9e39cd2c7422))
- **main:** Move window security handlers into createWindow by @lyestarzalt([abdc055](https://github.com/lyestarzalt/x-dispatch/commit/abdc0550dfb5afa05d9b9a4f7eab383592a5a0fd))

### Refactor

- **layers:** Centralize zoom levels with named ZOOM_LEVEL constants by @lyestarzalt([1ea12bf](https://github.com/lyestarzalt/x-dispatch/commit/1ea12bf6ac562c0f2728aaf1cd050b5d9d999a08))

### Documentation

- Update CHANGELOG.md for v1.2.1 by @github-actions[bot]([420b945](https://github.com/lyestarzalt/x-dispatch/commit/420b9456597033318ad7a8bb7f6c8faa41e70ce6))
- Add Ko-fi donation badge and link by @lyestarzalt([b0cce0f](https://github.com/lyestarzalt/x-dispatch/commit/b0cce0f87117511220fb756394b784f4a6ab5d8b))
- Move macOS install notice below intro section by @lyestarzalt([fd944ae](https://github.com/lyestarzalt/x-dispatch/commit/fd944aefb44539083450f84ea61e28ec38a1d588))
- Update X-Plane requirement to 12.4+ by @lyestarzalt([8ef8830](https://github.com/lyestarzalt/x-dispatch/commit/8ef8830e2f66382c7b622ab02b2f3e52e409f138))

### Release

- 1.3.0 by @github-actions[bot]([109b094](https://github.com/lyestarzalt/x-dispatch/commit/109b09471fa7aa84867bdcffdeba65fa65e88696))


## v1.2.1 - 2026-02-28

### Features

- **gates:** Square helipad backgrounds with heading indicator by @lyestarzalt([57fd3ca](https://github.com/lyestarzalt/x-dispatch/commit/57fd3ca44ad0346a673ac75a6d8f1af28bfea01f))

### Bug Fixes

- **parser:** Gates pointing wrong direction due to negative headings in apt.dat by @lyestarzalt([049692e](https://github.com/lyestarzalt/x-dispatch/commit/049692e1c620800a0af9428c111dbb8cfe5ff1a6))

### Documentation

- Add CHANGELOG.md and auto-update on release by @lyestarzalt([5be512d](https://github.com/lyestarzalt/x-dispatch/commit/5be512dad83c638e81ccc551e19c006ad6649dfd))
- Add star prompt to README by @lyestarzalt([cafd26e](https://github.com/lyestarzalt/x-dispatch/commit/cafd26ee9acd6dfcbffa0d0edb843cea07bf0a4c))

### Miscellaneous

- Update package.json keywords and description by @lyestarzalt([46988ca](https://github.com/lyestarzalt/x-dispatch/commit/46988cad97dfd2772b6512e04de2d098a4db779f))

### CI/CD

- Add Discord notification on release by @lyestarzalt([5f3b7c6](https://github.com/lyestarzalt/x-dispatch/commit/5f3b7c65128e306508527a0e55bb08359efa0835))
- **release:** Pull latest before changelog commit in finalize step by @lyestarzalt([ac8dcec](https://github.com/lyestarzalt/x-dispatch/commit/ac8dcec292d747bf36d9a19dc3cfdeba36430ad9))

### Release

- 1.2.1 by @github-actions[bot]([1583ea1](https://github.com/lyestarzalt/x-dispatch/commit/1583ea1b2533ba42394bd13283a27836bffb3770))


## v1.2.0 - 2026-02-28

### Features

- **map:** Add phase-colored route, T/C T/D markers, and alternate airport to flight plan layer by @lyestarzalt([d4302c6](https://github.com/lyestarzalt/x-dispatch/commit/d4302c65cb9de52abeb810e853e3b98cf735e04e))
- **simbrief:** Expand OFP dialog with vertical profile, navlog, performance, and briefing tabs by @lyestarzalt([8c47571](https://github.com/lyestarzalt/x-dispatch/commit/8c4757182cccade1124fd1387db3bceedd49cbf9))

### Bug Fixes

- **sentry:** Upload source maps for all processes and enable tracing and session replay by @lyestarzalt([edf288b](https://github.com/lyestarzalt/x-dispatch/commit/edf288b1fd9e0bf57ce11cea8cb0760104cd6470))

### Documentation

- Update flight setup screenshot by @lyestarzalt([f4bc66c](https://github.com/lyestarzalt/x-dispatch/commit/f4bc66cb830566f56e136e98ae1a12c2e30f7968))

### Release

- 1.2.0 by @github-actions[bot]([89c4ac4](https://github.com/lyestarzalt/x-dispatch/commit/89c4ac405cd89bc3be9e6fdd8ae54473a308152b))


## v1.1.0 - 2026-02-27

### Features

- **addon-manager:** Add core types and Result utilities by @lyestarzalt([59e8343](https://github.com/lyestarzalt/x-dispatch/commit/59e8343ede4f9031732b39b7511cf55f12fe1048))
- **addon-manager:** Add scenery_packs.ini parser by @lyestarzalt([937fb45](https://github.com/lyestarzalt/x-dispatch/commit/937fb4591e8d1104afc3c00f7ba281b6f4519c88))
- **addon-manager:** Add DSF binary header parser by @lyestarzalt([3eea54a](https://github.com/lyestarzalt/x-dispatch/commit/3eea54aac8a540e1d9638967ac89d81f30a66b09))
- **addon-manager:** Add folder scanner for classification by @lyestarzalt([3a3ae20](https://github.com/lyestarzalt/x-dispatch/commit/3a3ae20f5ca6316a7b5f137dc950f76eafd7219f))
- **addon-manager:** Add scenery classifier with priority tiers by @lyestarzalt([8a7b4a5](https://github.com/lyestarzalt/x-dispatch/commit/8a7b4a5b04166bb8c75f319af3339c5d9eeb9a87))
- **addon-manager:** Add SceneryManager class by @lyestarzalt([9d68184](https://github.com/lyestarzalt/x-dispatch/commit/9d681849c2e89df6f8a48e11ce6b9152ca5f2c0b))
- **addon-manager:** Extract IPC handlers to separate module by @lyestarzalt([26a6e54](https://github.com/lyestarzalt/x-dispatch/commit/26a6e548e7ae482e5a6c58497c1db34bbaf966fc))
- **addon-manager:** Add React Query hooks by @lyestarzalt([b842fcd](https://github.com/lyestarzalt/x-dispatch/commit/b842fcd4cecfce330e3aba94209e4ccd695e5b3b))
- **addon-manager:** Add Addon Manager dialog UI by @lyestarzalt([46ee67c](https://github.com/lyestarzalt/x-dispatch/commit/46ee67ca013f0c3f1c16b6216a15ecff5dedc532))
- **addon-manager:** Integrate with main process and UI by @lyestarzalt([8a111f3](https://github.com/lyestarzalt/x-dispatch/commit/8a111f37011a09e3637181be0133e8d801f6a97d))
- **addon-browser:** Add browser types by @lyestarzalt([b17f5ce](https://github.com/lyestarzalt/x-dispatch/commit/b17f5cef9aa11700e58ece677e62988b5b60148d))
- **addon-browser:** Add version detector module by @lyestarzalt([b7d5dbc](https://github.com/lyestarzalt/x-dispatch/commit/b7d5dbcababb5db154de89d75b3e73642b5e3ddd))
- **addon-browser:** Add aircraft scanner by @lyestarzalt([46bc1d7](https://github.com/lyestarzalt/x-dispatch/commit/46bc1d76d937453a53bb7133206661bee946eb4e))
- **addon-browser:** Implement installed addon browser with security hardening by @lyestarzalt([ba7500d](https://github.com/lyestarzalt/x-dispatch/commit/ba7500dffc91acad49a3dfac4d50dfff897fafcb))
- **installer:** Add installer types by @lyestarzalt([382e171](https://github.com/lyestarzalt/x-dispatch/commit/382e171ddafde1343ac0b091d1435f65e75a2266))
- **installer:** Add archive scanner for ZIP/7z/RAR by @lyestarzalt([e61ccee](https://github.com/lyestarzalt/x-dispatch/commit/e61cceeecfa6aadea648697c59af18c5e7b3db83))
- **installer:** Add type detector for addon classification by @lyestarzalt([8758974](https://github.com/lyestarzalt/x-dispatch/commit/875897409f8e68664115d2b381dd93ab93853067))
- **installer:** Add InstallerManager with analyze method by @lyestarzalt([059d9ef](https://github.com/lyestarzalt/x-dispatch/commit/059d9ef7a515e134d6d590850832435f4ded8b6b))
- **installer:** Add installer:analyze IPC handler by @lyestarzalt([0c261a3](https://github.com/lyestarzalt/x-dispatch/commit/0c261a37bc46a968f395f6313d91a9ffe24af90c))
- **installer:** Add installer preload API by @lyestarzalt([1a262fd](https://github.com/lyestarzalt/x-dispatch/commit/1a262fda6b80b4c8980cf67b48282b1a7d21bf50))
- **installer:** Add useInstallerAnalyze hook by @lyestarzalt([5e0e119](https://github.com/lyestarzalt/x-dispatch/commit/5e0e11966a43235ae0557bf276c6ae02dd2ad990))
- **installer:** Add InstallerTab UI with DropZone by @lyestarzalt([2f12a08](https://github.com/lyestarzalt/x-dispatch/commit/2f12a086f49ef66ff27e538669edcf002b0b41b2))
- **installer:** Integrate InstallerTab into AddonManager by @lyestarzalt([b2d6699](https://github.com/lyestarzalt/x-dispatch/commit/b2d6699351f7ebd7682a064ada8a3d6e3e3d177c))
- **installer:** Add click-to-browse file picker by @lyestarzalt([d41d5ff](https://github.com/lyestarzalt/x-dispatch/commit/d41d5ff4db2fedf00804db04a249df15693bfb25))
- **installer:** Implement Phase 2 addon installation by @lyestarzalt([159b74e](https://github.com/lyestarzalt/x-dispatch/commit/159b74e9509fbba612211ed7e159bad37778da21))
- **addon-manager:** Add logging for key operations by @lyestarzalt([8d79113](https://github.com/lyestarzalt/x-dispatch/commit/8d79113f2b6cb722b7c4bef6100863c84d56235a))
- **addon-manager:** Add i18n support by @lyestarzalt([83b1925](https://github.com/lyestarzalt/x-dispatch/commit/83b192519577840593c0855e87040712be444233))
- **addon-manager:** Complete i18n for all components by @lyestarzalt([5ec780a](https://github.com/lyestarzalt/x-dispatch/commit/5ec780a028612f0b9d6d10541c291f6a2cecd987))
- **i18n:** Add addonManager translations for all languages by @lyestarzalt([35478bb](https://github.com/lyestarzalt/x-dispatch/commit/35478bb28b1a980635384fd00b8c1daf777fb610))
- **addon-manager:** Redesign UI/UX for all tabs by @lyestarzalt([94be0c9](https://github.com/lyestarzalt/x-dispatch/commit/94be0c9c6f5d86e011e95069ffc6589bca073b3a))
- **toolbar:** Add Alpha badge to Addons button by @lyestarzalt([d493b9c](https://github.com/lyestarzalt/x-dispatch/commit/d493b9cf838dde5929757d74d1f3a56907d2e1c8))
- **simbrief:** Add SimBrief flight plan import integration by @lyestarzalt([940096c](https://github.com/lyestarzalt/x-dispatch/commit/940096caa5eccffc1560965e20ec90a39e2ae7ac))

### Bug Fixes

- Resolve multiple Sentry bugs by @lyestarzalt([0ed0597](https://github.com/lyestarzalt/x-dispatch/commit/0ed0597731f53c25c47e3e632ae3cd95bd293aaa))
- **map:** Defer layer removal during render to prevent MapLibre crash by @lyestarzalt([3d60af4](https://github.com/lyestarzalt/x-dispatch/commit/3d60af404e8029ea3d5ec3ed331f2a0534a8eff1))
- **map:** Throttle approach light animation to 30fps by @lyestarzalt([6444029](https://github.com/lyestarzalt/x-dispatch/commit/6444029d9c3a4ed1a6db5a1cc3f849dac343a523))
- **tracker:** Clear stale flight data on reconnect and add reconnect button by @lyestarzalt([22f2ada](https://github.com/lyestarzalt/x-dispatch/commit/22f2ada03036058637639b75208f3b9b65c1ff85))
- **addon-manager:** Add backup cleanup and error handling by @lyestarzalt([60a5624](https://github.com/lyestarzalt/x-dispatch/commit/60a5624690d494243cc3099c970d7f43af85108e))
- **apt-parser:** Handle seaplane and heliport headers by @lyestarzalt([ea04c55](https://github.com/lyestarzalt/x-dispatch/commit/ea04c551b6166fff8a32a876e0ffe108e5c29aca))
- **installer:** Address null safety issues by @lyestarzalt([1b957f8](https://github.com/lyestarzalt/x-dispatch/commit/1b957f8234c148820ae797e77d8754be1a4bac96))
- **installer:** Remove duplicate empty state text by @lyestarzalt([accf67d](https://github.com/lyestarzalt/x-dispatch/commit/accf67de79896794a67f685698202780a1eb9855))
- Remove plane marker when X-Plane process stops by @lyestarzalt([a4c69b6](https://github.com/lyestarzalt/x-dispatch/commit/a4c69b63d0c00cb03eeeec67cff41dfe14ef6c0a))

### Refactor

- **db:** Replace manual SQL with Drizzle migrations by @lyestarzalt([3eeb945](https://github.com/lyestarzalt/x-dispatch/commit/3eeb945b3338a383a9201dddffc2f64b815f5084))

### Documentation

- Update README with SimBrief and Addon Manager features by @lyestarzalt([35bbfba](https://github.com/lyestarzalt/x-dispatch/commit/35bbfba3f6e1fbbb42e4812eceb5eef932d5aa2c))
- Add starting position and tracking screenshots, update Discord link by @lyestarzalt([dcf87a0](https://github.com/lyestarzalt/x-dispatch/commit/dcf87a0ff246b2b633e916984e41164dba19f600))
- Update settings screenshot by @lyestarzalt([68d9556](https://github.com/lyestarzalt/x-dispatch/commit/68d9556ada3c2458a01bb704c3db8c3fad13c4d0))

### Miscellaneous

- Add TODO for TerrainControl crash issue by @lyestarzalt([2dc4e60](https://github.com/lyestarzalt/x-dispatch/commit/2dc4e60d612982e86937f26eacc0a1495c3d32ec))
- **ci:** Add commit links to changelog by @lyestarzalt([9e89f86](https://github.com/lyestarzalt/x-dispatch/commit/9e89f86c14463ab5f167cbe3119cb8f06db19a83))
- Add memory optimization TODO by @lyestarzalt([ca049b6](https://github.com/lyestarzalt/x-dispatch/commit/ca049b636ad669aa7f53cfc50c5b311aeb4dad5d))
- Add archive handling dependencies by @lyestarzalt([244b54d](https://github.com/lyestarzalt/x-dispatch/commit/244b54d2f9a5bcb7695886748ebeba2e2a949e8e))
- Remove debug console.log statements by @lyestarzalt([9baed2a](https://github.com/lyestarzalt/x-dispatch/commit/9baed2a72ab5ed3d00a6a8bc000cddf5e875aa4e))

### Release

- 1.1.0 by @github-actions[bot]([2658ee0](https://github.com/lyestarzalt/x-dispatch/commit/2658ee0919b90b0e15dc91199487e358df444d49))


## v1.0.0 - 2026-02-24

### Features

- Add flight plan loading and nav layer consolidation by @lyestarzalt([ab6f7c9](https://github.com/lyestarzalt/x-dispatch/commit/ab6f7c92c992943a5b244942a6a6176684c8de50))
- Add follow mode for plane tracking by @lyestarzalt([9122162](https://github.com/lyestarzalt/x-dispatch/commit/9122162ca0ef0ec950c40f2a98cf0aee272c02c8))
- Add Sentry error tracking integration by @lyestarzalt([287cd7c](https://github.com/lyestarzalt/x-dispatch/commit/287cd7c47eb005c6e17e6f8960c7964a9fff104a))
- **flightplan:** Enrich waypoints with nav database info by @lyestarzalt([237efe3](https://github.com/lyestarzalt/x-dispatch/commit/237efe3eb76dae964147de17d90815e139a37cd6))
- **metar:** Integrate metar-taf-parser library for proper METAR decoding by @lyestarzalt([24a6bfd](https://github.com/lyestarzalt/x-dispatch/commit/24a6bfd1c8403fc66a1269e106ddd3e2a33ca8a7))
- **i18n:** Add translations for toolbar tooltips and airport panel by @lyestarzalt([d232755](https://github.com/lyestarzalt/x-dispatch/commit/d232755268885d668a17ad0431156a52a7621852))
- **map:** Custom airport markers and navigation fixes by @lyestarzalt([29cbdac](https://github.com/lyestarzalt/x-dispatch/commit/29cbdac18fcab91877475535682adec3412be5f7))
- **map:** Use pin beacon icon for custom airports by @lyestarzalt([72b09d8](https://github.com/lyestarzalt/x-dispatch/commit/72b09d8cc92b881d19099545671893255d925106))
- **launch:** Improve flight config UI and require start position by @lyestarzalt([8406616](https://github.com/lyestarzalt/x-dispatch/commit/8406616e71e14e27613d86faf391b87dcd2e370b))
- **logging:** Add production support logging for user diagnostics by @lyestarzalt([b09c2eb](https://github.com/lyestarzalt/x-dispatch/commit/b09c2ebdcc470a6aa5c443516b504194e61aa86d))
- **privacy:** Add opt-out crash reporting toggle in settings by @lyestarzalt([fd3e6e6](https://github.com/lyestarzalt/x-dispatch/commit/fd3e6e6b89ee5c1ca198cf2f870cacba2d3cfcaa))

### Bug Fixes

- Add SQLite caching for navigation data by @lyestarzalt([c3c8812](https://github.com/lyestarzalt/x-dispatch/commit/c3c8812d3def649bb92752c30a5dd6a465ede25a))
- Track nav data source type for Navigraph switching by @lyestarzalt([dbb24b8](https://github.com/lyestarzalt/x-dispatch/commit/dbb24b83b363a57ca815434497dfea019d6f22fb))
- Add migration for source_type column in nav_file_meta by @lyestarzalt([a49aceb](https://github.com/lyestarzalt/x-dispatch/commit/a49acebeb97f0d0e0ceb46981e3b39aec2c39b6b))
- Add null guards to prevent 'getLayer' errors on undefined map by @lyestarzalt([2b204f8](https://github.com/lyestarzalt/x-dispatch/commit/2b204f841ca43eed600f332485376e5860cbdb24))
- Properly re-add layers after map style change by @lyestarzalt([b43cbeb](https://github.com/lyestarzalt/x-dispatch/commit/b43cbeb774e11d572993f6bbff937209e48df4d0))
- Centralize styleVersion subscription to avoid HMR errors by @lyestarzalt([bc3fa33](https://github.com/lyestarzalt/x-dispatch/commit/bc3fa339f24356a42767159750db219410a0f033))
- **ui:** Improve main UI layout and UX by @lyestarzalt([bb8f4b4](https://github.com/lyestarzalt/x-dispatch/commit/bb8f4b4e4deec44658c7a6d1435f35220332c5a8))
- **ui:** Position FlightStrip above FlightPlanBar when visible by @lyestarzalt([8719458](https://github.com/lyestarzalt/x-dispatch/commit/87194588f3044abe57a35627285bc16e6c4954b0))
- Prevent programmatic map movements from disabling follow mode by @lyestarzalt([7e749b8](https://github.com/lyestarzalt/x-dispatch/commit/7e749b83a0d430a1850eb9665a1b73de3cf99e9c))
- Improve plane tracking and fix airport layer displacement by @lyestarzalt([8312af6](https://github.com/lyestarzalt/x-dispatch/commit/8312af698d422584bd0f6d310fa656d974b34ee3))
- Remove Sentry from preload (incompatible with sandbox) by @lyestarzalt([edbe735](https://github.com/lyestarzalt/x-dispatch/commit/edbe735089ad7f1e3a85d2a2360edd91235200d1))
- **map:** Prevent getLayer crashes after map destruction by @lyestarzalt([92f128e](https://github.com/lyestarzalt/x-dispatch/commit/92f128e868aca2bbfb4e959cb790b3b46725858d))
- **map:** Simplify style change handling to prevent crashes by @lyestarzalt([7f295dd](https://github.com/lyestarzalt/x-dispatch/commit/7f295dd35db0d5c9d95c246061ef3d1da356783e))
- **validation:** Allow X-Plane internal airport IDs up to 7 chars by @lyestarzalt([6f06878](https://github.com/lyestarzalt/x-dispatch/commit/6f06878f06f5bdcb49b5618d8845ecf1c56796e5))
- **ux:** Add tooltip to disabled Launch button by @lyestarzalt([b0ed84d](https://github.com/lyestarzalt/x-dispatch/commit/b0ed84d87ba90194fad7b3c9a70416640345b6c0))
- **layout:** Restructure top bar and sidebar positioning by @lyestarzalt([32ddb27](https://github.com/lyestarzalt/x-dispatch/commit/32ddb27b5104e54b632a4e7431830adcecbda242))
- **ui:** Restore CompassWidget and fix positioning by @lyestarzalt([f5d15c6](https://github.com/lyestarzalt/x-dispatch/commit/f5d15c685eb42759ccb7371ea5276b1509e22d43))
- **procedures:** Improve CIFP parsing for SID/STAR/Approach accuracy by @lyestarzalt([dec67a2](https://github.com/lyestarzalt/x-dispatch/commit/dec67a2b7225ac07d6493f2db662f2eae3fd892e))
- **ui:** Restore ExplorePanel and fix route antimeridian crossing by @lyestarzalt([f970e2b](https://github.com/lyestarzalt/x-dispatch/commit/f970e2b52105f878866043757070571746aa8d00))
- **airspace:** Ensure counter-clockwise winding for GeoJSON polygons by @lyestarzalt([a502fad](https://github.com/lyestarzalt/x-dispatch/commit/a502fad5161b8c4e2e80d1f8377d276908bc7b3d))
- **airspace:** Filter out antimeridian-crossing polygons by @lyestarzalt([e8f48ab](https://github.com/lyestarzalt/x-dispatch/commit/e8f48ab3aa8e6f57d91245d5db33213ea6d4cbfd))
- **readme:** Add cache-busting param to shields.io badges by @lyestarzalt([3658fbc](https://github.com/lyestarzalt/x-dispatch/commit/3658fbc3f0e23b0232722d7acb34029b13f5d7d7))

### Refactor

- Consolidate navigation types with proper enums by @lyestarzalt([fa6b823](https://github.com/lyestarzalt/x-dispatch/commit/fa6b8234d74922fa572516704206ea0d635a6f2e))
- **ui:** Improve FlightPlanBar layout and interactions by @lyestarzalt([4ef2936](https://github.com/lyestarzalt/x-dispatch/commit/4ef293623fdcbda386b927740563b39f9a710930))
- Rename Sidebar to AirportInfoPanel and remove FlightPlanTab by @lyestarzalt([6f3f544](https://github.com/lyestarzalt/x-dispatch/commit/6f3f5449851dfa8e4fde33250a63d736b5a1dde3))
- **compass:** Remove wind indicator, keep only heading by @lyestarzalt([9caa9a1](https://github.com/lyestarzalt/x-dispatch/commit/9caa9a1f55fbfc578785e44e8072db62aa53fe85))
- **ui:** Redesign AirportInfoPanel with better info hierarchy by @lyestarzalt([3eafde0](https://github.com/lyestarzalt/x-dispatch/commit/3eafde07aa8a44bdebb9596456f628ac1a46015e))
- **launch:** Redesign aircraft preview with livery navigation by @lyestarzalt([1caa3c8](https://github.com/lyestarzalt/x-dispatch/commit/1caa3c8f855f26082e7f369e4582b06601a461d1))

### Documentation

- Add open source community templates by @lyestarzalt([6b214d4](https://github.com/lyestarzalt/x-dispatch/commit/6b214d47bdcb33189988db937ec438be3eca14de))
- **readme:** Add Discord badge, tech stack badges, and support section by @lyestarzalt([dab3205](https://github.com/lyestarzalt/x-dispatch/commit/dab32052256794e85633c509215fde787fb4839a))
- Add flight plan screenshot to README by @lyestarzalt([0cfbed0](https://github.com/lyestarzalt/x-dispatch/commit/0cfbed01addad160fa97e492d621e01e13e46e10))

### Miscellaneous

- Add Sentry source maps and conventional changelog by @lyestarzalt([ae69cc2](https://github.com/lyestarzalt/x-dispatch/commit/ae69cc202adf0cd9370190a3312bd1f4abd41fea))
- Update Sentry config with env vars for org/project by @lyestarzalt([87498ae](https://github.com/lyestarzalt/x-dispatch/commit/87498ae75c90d6397ea8c94dcd181862a8c3a113))

### Release

- 1.0.0 by @github-actions[bot]([bb630f9](https://github.com/lyestarzalt/x-dispatch/commit/bb630f993e6ac39f2d1d6258db38aebc0ebe2b0d))


## v0.9.4 - 2026-02-19

### Bug Fixes

- Improve launch logging and folder picker reliability by @lyestarzalt([d2588f5](https://github.com/lyestarzalt/x-dispatch/commit/d2588f51903814eb86b565585ae7b330da23f9fe))

### Release

- 0.9.4 by @github-actions[bot]([06dc2a7](https://github.com/lyestarzalt/x-dispatch/commit/06dc2a75d0c8b4d9bdabf7d7170c47d0b7021adb))


## v0.9.3 - 2026-02-19

### Features

- Parse startup location metadata (row code 1301) by @lyestarzalt([f8fc584](https://github.com/lyestarzalt/x-dispatch/commit/f8fc5848f9c9c275e89097c4a2efecb90ea425e8))
- Use precise coordinates for REST API ramp spawning by @lyestarzalt([9af7e15](https://github.com/lyestarzalt/x-dispatch/commit/9af7e159c89191283377fa8dd2186ff0916f3088))

### Bug Fixes

- Preserve user preferences when writing Freeflight.prf by @lyestarzalt([63a7690](https://github.com/lyestarzalt/x-dispatch/commit/63a7690f103f0a98504109d2700ce9be2f590ea1))
- Include ws and related packages in build by @lyestarzalt([ad55436](https://github.com/lyestarzalt/x-dispatch/commit/ad55436ed28dca83aa8a698617f2efe5e8cf614f))
- Prevent database closing on macOS window close by @lyestarzalt([736454b](https://github.com/lyestarzalt/x-dispatch/commit/736454b96e9c7a9512ffc9605acbc19794e171ff))

### Refactor

- Extract launch execution logic to dedicated executor module by @lyestarzalt([89de9db](https://github.com/lyestarzalt/x-dispatch/commit/89de9dbd724c3c089e0778face90a95319366a37))

### Miscellaneous

- Add TODO comments for freeflightGenerator refactoring by @lyestarzalt([97c3e37](https://github.com/lyestarzalt/x-dispatch/commit/97c3e377eb052c9b270dcc9dd7d8737ddbe16f34))

### Release

- 0.9.3 by @github-actions[bot]([ceb8111](https://github.com/lyestarzalt/x-dispatch/commit/ceb8111f032d3b8ba47266da424c8e457cf67dff))


## v0.9.2 - 2026-02-19

### Bug Fixes

- Package electron-squirrel-startup for Windows builds by @lyestarzalt([ce65589](https://github.com/lyestarzalt/x-dispatch/commit/ce6558981b0f5cf03fbe9efa9cd055b9de57b271))

### Release

- 0.9.2 by @github-actions[bot]([273f536](https://github.com/lyestarzalt/x-dispatch/commit/273f53617d9d7b89ee01fabec1fccf2e63d16fd6))


## v0.9.1 - 2026-02-18

### Refactor

- Architecture overhaul with TanStack Query, centralized types, and spawn fixes (#24) by @lyestarzalt([24c8f38](https://github.com/lyestarzalt/x-dispatch/commit/24c8f38b226f3c58cd2e16066da656661544ae8a))

### Release

- 0.9.1 by @github-actions[bot]([6cb7933](https://github.com/lyestarzalt/x-dispatch/commit/6cb7933e70f06fecc0f013d7e886e5d7c538817f))


## v0.9.0 - 2026-02-13

### Documentation

- Update screenshots to reflect new UI by @lyestarzalt([2cc2f51](https://github.com/lyestarzalt/x-dispatch/commit/2cc2f51cb5da90aa37db395354b5894505eab4ff))

### Release

- 0.9.0 by @github-actions[bot]([f9b56f2](https://github.com/lyestarzalt/x-dispatch/commit/f9b56f2efb7b3c2f9086bfb68805ac94850ec49f))


## v0.8.0 - 2026-02-08

### Release

- 0.8.0 by @github-actions[bot]([05b3bf9](https://github.com/lyestarzalt/x-dispatch/commit/05b3bf96b62a3b85526e26c60b2791da898dddb9))


## v0.7.0 - 2026-02-07

### Features

- **signs:** Render airport signs as proper SVG rectangles by @lyestarzalt([f1eaf20](https://github.com/lyestarzalt/x-dispatch/commit/f1eaf208a79e4c70790a8789e529949fdd73c5d0))
- **layers:** Add helipad, beacon, and tower layers by @lyestarzalt([aa4091b](https://github.com/lyestarzalt/x-dispatch/commit/aa4091b17e50574c8f6d8507d2b5961ced8a5076))
- **ui:** X-Plane design system overhaul and unit preferences by @lyestarzalt([610f18f](https://github.com/lyestarzalt/x-dispatch/commit/610f18fb8c27073ddb0bd8ded4969ec028d7222b))
- Load React DevTools in development mode by @lyestarzalt([8956a62](https://github.com/lyestarzalt/x-dispatch/commit/8956a62c5487f995dab699aab497131bfd6cb9c0))
- **db:** Add aptFileMeta table and airport metadata columns by @lyestarzalt([9c00050](https://github.com/lyestarzalt/x-dispatch/commit/9c00050e5a840047be928502437ed7c6a8f23f34))
- **db:** Update table creation for new schema by @lyestarzalt([ca8b644](https://github.com/lyestarzalt/x-dispatch/commit/ca8b644764b12d91cf32caecf867b5dd0e6c31d0))
- **xplane:** Add types for apt.dat parsing by @lyestarzalt([3685ec5](https://github.com/lyestarzalt/x-dispatch/commit/3685ec5c4d79304b55da9822d2a7defabbbdcd5f))
- **xplane:** Add file mtime checking for cache invalidation by @lyestarzalt([454ee8a](https://github.com/lyestarzalt/x-dispatch/commit/454ee8a64b7062958fd434479f024507da42ff76))
- **xplane:** Extract 1302 metadata during apt.dat parsing by @lyestarzalt([52d2e9b](https://github.com/lyestarzalt/x-dispatch/commit/52d2e9be12ebccc6339b3436aef7d04efb8591cc))
- **xplane:** Implement batch inserts and cache checking by @lyestarzalt([0809a10](https://github.com/lyestarzalt/x-dispatch/commit/0809a109d6a94646bf71f5e4fd99581b699bd1f4))
- **xplane:** Update clear to also clear aptFileMeta by @lyestarzalt([3abed83](https://github.com/lyestarzalt/x-dispatch/commit/3abed83f94f0894c0d49ba1ecef6524409568604))
- Add Explore feature for discovering airports and routes (#14) (#15) by @lyestarzalt([f3dcc4c](https://github.com/lyestarzalt/x-dispatch/commit/f3dcc4cfbeffc8248c5e722f7a5d6397e4cbe6e0))

### Bug Fixes

- **layers:** Add barIndex for approach lights and extract surface types by @lyestarzalt([7949175](https://github.com/lyestarzalt/x-dispatch/commit/7949175d8f19eb2c2916cb2bd12c43639fbd176a))
- **aptParser:** Fix bezier curve parsing for smooth pavements by @lyestarzalt([1e341c0](https://github.com/lyestarzalt/x-dispatch/commit/1e341c05eb6138a092d3c54bdf25ee61064639e7))
- **runways:** Render shoulders with default width when not specified by @lyestarzalt([00b2d19](https://github.com/lyestarzalt/x-dispatch/commit/00b2d198777e5ad3ed529f62dc597cfa8e52aa8e))
- **linearFeature:** Airport lines not rendred properly by @lyestarzalt([6150097](https://github.com/lyestarzalt/x-dispatch/commit/6150097d8c8201cd95ff52118a37852dc8ed458b))
- **airspace:** Improve label readability with line placement by @lyestarzalt([f72810e](https://github.com/lyestarzalt/x-dispatch/commit/f72810e5cbd26647afa7df14598427bda4366964))
- CSP, sign scaling, and sign parsing issues by @lyestarzalt([48eb72d](https://github.com/lyestarzalt/x-dispatch/commit/48eb72d6181b42f133ac24f34aa7f6e28a90e601))
- **signs:** Use constant icon size and trigger repaint after image load by @lyestarzalt([13667bd](https://github.com/lyestarzalt/x-dispatch/commit/13667bd1996fe1ff9b14c0336553d2eaa89d85cc))
- **signs:** Pre-generate all sign images before adding layer by @lyestarzalt([a01f4fc](https://github.com/lyestarzalt/x-dispatch/commit/a01f4fc7d5e6e7fef91875e2b883e53448e72c00))
- **types:** Sync Aircraft interface in preload.ts with launcher types by @lyestarzalt([4754010](https://github.com/lyestarzalt/x-dispatch/commit/4754010a9e89c0809d12a5d09378e9bf39a2300e))

### Refactor

- **layers:** Standardize map layers with class-based architecture by @lyestarzalt([7fb728d](https://github.com/lyestarzalt/x-dispatch/commit/7fb728d95d34e6b1e32ad14e72d0b2c80f5bb0aa))
- **nav-layers:** Consolidate config and remove legacy exports by @lyestarzalt([33f80bc](https://github.com/lyestarzalt/x-dispatch/commit/33f80bc3813cf452e7b7fba226bf7252bb92a534))
- **signs:** Use text labels instead of SVG images, fix CSP for Google Fonts by @lyestarzalt([1b11dc5](https://github.com/lyestarzalt/x-dispatch/commit/1b11dc51e8eebccb47f4cf3bd7747985cf79144e))

### Documentation

- **plans:** Add sign layer redesign spec by @lyestarzalt([4eadb5d](https://github.com/lyestarzalt/x-dispatch/commit/4eadb5d61c1bb7716ff4a46b8a658e0038efaa1a))
- Add apt.dat cache invalidation design by @lyestarzalt([eb4f703](https://github.com/lyestarzalt/x-dispatch/commit/eb4f70314960f9008c2cf4099e44947cc0b76d59))
- Add implementation plan for apt.dat cache by @lyestarzalt([3b7ebb2](https://github.com/lyestarzalt/x-dispatch/commit/3b7ebb22aa8683aa41cd1e7c5997018db25e72ef))

### Miscellaneous

- Remove unused MORA and MSA layer code by @lyestarzalt([55b8dc0](https://github.com/lyestarzalt/x-dispatch/commit/55b8dc06d00dca000d807d3c90646305c31a62e3))
- Disable sign layer temporarily by @lyestarzalt([e7fa7a3](https://github.com/lyestarzalt/x-dispatch/commit/e7fa7a3f1e0f42d3cab2971f98046a3f44967a1b))

### Release

- 0.7.0 by @github-actions[bot]([b780a9c](https://github.com/lyestarzalt/x-dispatch/commit/b780a9c8f4ba87356cad743e22d8632c503cc091))


## v0.6.1 - 2026-02-03

### Miscellaneous

- Fix repo URLs and add macOS install note (#10) by @lyestarzalt([55ea3f1](https://github.com/lyestarzalt/x-dispatch/commit/55ea3f1d70c5cb407ae13754580dbfa59b6dad59))
- **ui:** Shadcn components, semantic colors, Map refactor & compass redesign  (#11) by @lyestarzalt([3620f16](https://github.com/lyestarzalt/x-dispatch/commit/3620f16bb6634aaa464b1728209e88f299d61380))

### Release

- 0.6.1 by @github-actions[bot]([e5e4a88](https://github.com/lyestarzalt/x-dispatch/commit/e5e4a889ee3927359465fe7d8fa50f99e2c98258))


## v0.6.0 - 2026-02-02

### Features

- **launcher:** Add cold & dark and system time options by @lyestarzalt([c38628f](https://github.com/lyestarzalt/x-dispatch/commit/c38628fd22358237cb04fa67c60fb99dc867fee8))

### Documentation

- Enhance README with logo and screenshots by @lyestarzalt([af08967](https://github.com/lyestarzalt/x-dispatch/commit/af08967bfb7bb6a4e330993b93762d9a3085d8dc))

### Release

- 0.6.0 by @github-actions[bot]([311de60](https://github.com/lyestarzalt/x-dispatch/commit/311de6047a0884b349d79e6470c01f59404785bf))


## v0.5.3 - 2026-02-02

### Features

- Add Dependabot configuration by @lyestarzalt([c9e3755](https://github.com/lyestarzalt/x-dispatch/commit/c9e37553ee8b5780b85d65a1de2ab802d953c863))

### Bug Fixes

- Hide menu bar and disable devtools in production by @lyestarzalt([799df0a](https://github.com/lyestarzalt/x-dispatch/commit/799df0af64390a5166c9e98c5eab474055cbb722))

### Refactor

- Simplify release workflow by @lyestarzalt([6e24b15](https://github.com/lyestarzalt/x-dispatch/commit/6e24b151a28ff7a08b225502fde47db6358f1117))

### Release

- 0.5.3 by @github-actions[bot]([96c4719](https://github.com/lyestarzalt/x-dispatch/commit/96c4719ad92934c6a7b8ea93e83770b9208564e3))



### New Contributors

- @github-actions[bot] made their first contribution
- @lyestarzalt made their first contribution
<!-- generated by git-cliff -->
