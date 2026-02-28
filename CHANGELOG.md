# Changelog

All notable changes to this project will be documented in this file.
## v1.2.1 - 2026-02-28

### Bug Fixes

- gates pointing wrong direction due to negative headings in apt.dat ([8d7c896](https://github.com/lyestarzalt/x-dispatch/commit/8d7c896e8fe90d44da24b4aabfd7b8e048eecede))

### Documentation

- add CHANGELOG.md and auto-update on release ([7722a2f](https://github.com/lyestarzalt/x-dispatch/commit/7722a2fe62031d3d8b16a6736a179d70e20c28f4))
- add star prompt to README ([c036324](https://github.com/lyestarzalt/x-dispatch/commit/c036324ddc7967e743a2cc5b7be8282758c07a6b))

### Features

- square helipad backgrounds with heading indicator ([9990d19](https://github.com/lyestarzalt/x-dispatch/commit/9990d19317e20b1fc848aeeb22f7b927eb853478))

### Miscellaneous

- update package.json keywords and description ([8ee7887](https://github.com/lyestarzalt/x-dispatch/commit/8ee78879518f127a597ef80fc3226a851f6f2800))
## v1.2.0 - 2026-02-28

### Bug Fixes

- upload source maps for all processes and enable tracing and session replay ([687ca22](https://github.com/lyestarzalt/x-dispatch/commit/687ca226a53d0d9ec20804ecc1dc7e0780ab2ffc))

### Documentation

- update flight setup screenshot ([5d9ee6a](https://github.com/lyestarzalt/x-dispatch/commit/5d9ee6a37ae4000fa961cbfbb11319d5156d2cea))

### Features

- add phase-colored route, T/C T/D markers, and alternate airport to flight plan layer ([0e77f64](https://github.com/lyestarzalt/x-dispatch/commit/0e77f64a8f4ab2e67219d9d0e5f428d9fcb18820))
- expand OFP dialog with vertical profile, navlog, performance, and briefing tabs ([b0e3189](https://github.com/lyestarzalt/x-dispatch/commit/b0e31896afd45ec1dd54f1f24809404e117ad21a))
## v1.1.0 - 2026-02-27

### Bug Fixes

- resolve multiple Sentry bugs ([4201c1c](https://github.com/lyestarzalt/x-dispatch/commit/4201c1c25f5f42088e1623bebbdf36a8f81cb3f1))
- defer layer removal during render to prevent MapLibre crash ([d2aaec7](https://github.com/lyestarzalt/x-dispatch/commit/d2aaec79872a4f04bfe6a80e329e2bcdcfa522b9))
- throttle approach light animation to 30fps ([d8fb89c](https://github.com/lyestarzalt/x-dispatch/commit/d8fb89c912f87d19b7e4de60be7b63b3e56514c6))
- clear stale flight data on reconnect and add reconnect button ([ba7d34d](https://github.com/lyestarzalt/x-dispatch/commit/ba7d34d554c9d9b171dc9d805f31b63848649b4e))
- add backup cleanup and error handling ([90abb34](https://github.com/lyestarzalt/x-dispatch/commit/90abb346b33965cc059ef523876a78b673135f63))
- handle seaplane and heliport headers ([31810dd](https://github.com/lyestarzalt/x-dispatch/commit/31810dd38da904258af0e8a2b7a4ecb0185261ae))
- address null safety issues ([8a1c2d7](https://github.com/lyestarzalt/x-dispatch/commit/8a1c2d71c42daf42eb726d0aa6e37763036ede5b))
- remove duplicate empty state text ([1d60835](https://github.com/lyestarzalt/x-dispatch/commit/1d6083525d7be97ab4c2c7b33877602ded457eca))
- remove plane marker when X-Plane process stops ([728b1cf](https://github.com/lyestarzalt/x-dispatch/commit/728b1cf8e6ca4359a1ac4fdc6822fdefda715ff4))

### Documentation

- update README with SimBrief and Addon Manager features ([c9ae82d](https://github.com/lyestarzalt/x-dispatch/commit/c9ae82d3bdc8d61df87db0fae19b9dc6bc620672))
- add starting position and tracking screenshots, update Discord link ([c0ecd6c](https://github.com/lyestarzalt/x-dispatch/commit/c0ecd6cc5898be54972c8594e1f25af921b24146))
- update settings screenshot ([a255187](https://github.com/lyestarzalt/x-dispatch/commit/a2551879bbe10a539f0933956a9f5983e165a2b0))

### Features

- add core types and Result utilities ([86c5048](https://github.com/lyestarzalt/x-dispatch/commit/86c5048cc1553c58a625fdb6688afb72bf58cd87))
- add scenery_packs.ini parser ([bdb28ad](https://github.com/lyestarzalt/x-dispatch/commit/bdb28ad65ad8c88b61c487a26aaa1f871fab1fd8))
- add DSF binary header parser ([9dc8f74](https://github.com/lyestarzalt/x-dispatch/commit/9dc8f74cab3e706f638a018c3468c5052538df93))
- add folder scanner for classification ([581ea0d](https://github.com/lyestarzalt/x-dispatch/commit/581ea0d203cb3f61eef0479cc2bd8c8004a2e68e))
- add scenery classifier with priority tiers ([7da73d7](https://github.com/lyestarzalt/x-dispatch/commit/7da73d754a77c1f76305c8e132dadb39cf35e4f6))
- add SceneryManager class ([0e025b1](https://github.com/lyestarzalt/x-dispatch/commit/0e025b126ac1a61dcd9588b66a4db62dd9a6d67b))
- extract IPC handlers to separate module ([0da606f](https://github.com/lyestarzalt/x-dispatch/commit/0da606fea8192715f1fbcd681f7ef9414b25506e))
- add React Query hooks ([98f7574](https://github.com/lyestarzalt/x-dispatch/commit/98f75743d2d83dc362f0c3789d6d01473e6d3cfc))
- add Addon Manager dialog UI ([d21dc17](https://github.com/lyestarzalt/x-dispatch/commit/d21dc179417bf63e4c8f234ccd6407d4bde7958d))
- integrate with main process and UI ([1b8aedd](https://github.com/lyestarzalt/x-dispatch/commit/1b8aedd9e2cb71ba48f21c373ce6c0ee2c71af9e))
- add browser types ([3b87a10](https://github.com/lyestarzalt/x-dispatch/commit/3b87a102e07f14696e664cd907c2a1faa2c7f592))
- add version detector module ([0fdee99](https://github.com/lyestarzalt/x-dispatch/commit/0fdee99a4f6765609e095ee983995c9124284128))
- add aircraft scanner ([53c565b](https://github.com/lyestarzalt/x-dispatch/commit/53c565b51824f528d7d03632e7ea2cc138ebae3f))
- implement installed addon browser with security hardening ([c39e22d](https://github.com/lyestarzalt/x-dispatch/commit/c39e22d44cf474216aba6267a29d355c3feba5f2))
- add installer types ([03a41a8](https://github.com/lyestarzalt/x-dispatch/commit/03a41a8d07d3d423f4511aef925ffcbfc5901925))
- add archive scanner for ZIP/7z/RAR ([1ae6330](https://github.com/lyestarzalt/x-dispatch/commit/1ae6330badcc1ef2f6082026343edba59a945e14))
- add type detector for addon classification ([26e1cda](https://github.com/lyestarzalt/x-dispatch/commit/26e1cda856bf71a186000aef2570097af2bc518e))
- add InstallerManager with analyze method ([0c411d0](https://github.com/lyestarzalt/x-dispatch/commit/0c411d06aea933b6b02778da6390faef17b44ccb))
- add installer:analyze IPC handler ([bab791c](https://github.com/lyestarzalt/x-dispatch/commit/bab791cec4bbaeb1bec1d92f625a0cf82f10a324))
- add installer preload API ([bb9c0e3](https://github.com/lyestarzalt/x-dispatch/commit/bb9c0e374bb25a8a9e2fb8b2cd360a9ef33ecbad))
- add useInstallerAnalyze hook ([9cc7347](https://github.com/lyestarzalt/x-dispatch/commit/9cc734754d1f9b9ed47271d8d5881aaa94b31dcb))
- add InstallerTab UI with DropZone ([d1502d6](https://github.com/lyestarzalt/x-dispatch/commit/d1502d68aeda7613f9eb7fcd28a4a1a86ab619fa))
- integrate InstallerTab into AddonManager ([c72a738](https://github.com/lyestarzalt/x-dispatch/commit/c72a738c968b353f100517fe3bb5d80be50f9aaa))
- add click-to-browse file picker ([d21de4a](https://github.com/lyestarzalt/x-dispatch/commit/d21de4ad6add3807b28f107a8870a188b0b31157))
- implement Phase 2 addon installation ([5e2a650](https://github.com/lyestarzalt/x-dispatch/commit/5e2a6503cb09cbc38d5f8545d3d3dead9aea7734))
- add logging for key operations ([53a293b](https://github.com/lyestarzalt/x-dispatch/commit/53a293bf6b1c6307909aa6cbddb350559d0d918f))
- add i18n support ([90447d2](https://github.com/lyestarzalt/x-dispatch/commit/90447d25806b7e560f65ac4ca28abb423d5b919e))
- complete i18n for all components ([614c74c](https://github.com/lyestarzalt/x-dispatch/commit/614c74c467dd4b5ae57c75fe785d79b4952966e9))
- add addonManager translations for all languages ([a3d7ce9](https://github.com/lyestarzalt/x-dispatch/commit/a3d7ce9452877580c5d059bdcd9ed626f7a15573))
- redesign UI/UX for all tabs ([9799939](https://github.com/lyestarzalt/x-dispatch/commit/9799939eaaa1f32d555a8e298901059ed63537ca))
- add Alpha badge to Addons button ([83aaf78](https://github.com/lyestarzalt/x-dispatch/commit/83aaf78b46b8267c46b14caafcbc2e5050bbb41a))
- add SimBrief flight plan import integration ([f4f2e57](https://github.com/lyestarzalt/x-dispatch/commit/f4f2e57b53d717218d0ec15f9071552824e9f285))

### Miscellaneous

- add TODO for TerrainControl crash issue ([caa2d30](https://github.com/lyestarzalt/x-dispatch/commit/caa2d30c00922b1fef7cdf38e64bf33f9f14501c))
- add commit links to changelog ([fc20c7e](https://github.com/lyestarzalt/x-dispatch/commit/fc20c7ee3ebc151400627b3d92a6ecd0ea75e130))
- add memory optimization TODO ([9f96c29](https://github.com/lyestarzalt/x-dispatch/commit/9f96c2918e83626affa3618067b4df695d70c2a3))
- add archive handling dependencies ([cd1ffd6](https://github.com/lyestarzalt/x-dispatch/commit/cd1ffd615ea2f1b2efdfd3e16e4feb98e5e97156))
- remove debug console.log statements ([600fdd1](https://github.com/lyestarzalt/x-dispatch/commit/600fdd126e5509afb6e82d5300db7ad4a831040a))

### Refactor

- replace manual SQL with Drizzle migrations ([09fa50b](https://github.com/lyestarzalt/x-dispatch/commit/09fa50b7b2c637ba8a44c776d6a92b3102bee409))
## v1.0.0 - 2026-02-24

### Bug Fixes

- add SQLite caching for navigation data ([857d2a4](https://github.com/lyestarzalt/x-dispatch/commit/857d2a4098794798d2454b11f318713051758aca))
- track nav data source type for Navigraph switching ([2dddb4b](https://github.com/lyestarzalt/x-dispatch/commit/2dddb4bba299c3ea93df5f19ce15fab9624dbb08))
- add migration for source_type column in nav_file_meta ([99f66c6](https://github.com/lyestarzalt/x-dispatch/commit/99f66c607574b461193f72c3c66dbf43f422f5b2))
- add null guards to prevent 'getLayer' errors on undefined map ([7c12be2](https://github.com/lyestarzalt/x-dispatch/commit/7c12be2f723593221dbf2720a595ed140eb64e69))
- properly re-add layers after map style change ([ac21d62](https://github.com/lyestarzalt/x-dispatch/commit/ac21d629c98c7c1013ba09b9afa020c8f1ef1b01))
- centralize styleVersion subscription to avoid HMR errors ([e5bbb4c](https://github.com/lyestarzalt/x-dispatch/commit/e5bbb4c298a23d8d460fcdc9687f6b979ea22b97))
- improve main UI layout and UX ([f549f2d](https://github.com/lyestarzalt/x-dispatch/commit/f549f2dd16b30e96a168a443f96335af9622c1ec))
- position FlightStrip above FlightPlanBar when visible ([5bf84cc](https://github.com/lyestarzalt/x-dispatch/commit/5bf84cc88b5cac7988960a4811a98e130248ac8f))
- prevent programmatic map movements from disabling follow mode ([ace9a13](https://github.com/lyestarzalt/x-dispatch/commit/ace9a1324445b641bd43b3db0e06e83eb4faf168))
- improve plane tracking and fix airport layer displacement ([cbd65c8](https://github.com/lyestarzalt/x-dispatch/commit/cbd65c823b67a1e71519fd2cee45faf768f949a6))
- remove Sentry from preload (incompatible with sandbox) ([be00f87](https://github.com/lyestarzalt/x-dispatch/commit/be00f874375eaf244de519d29a57e645e0aa5939))
- prevent getLayer crashes after map destruction ([71fe4ee](https://github.com/lyestarzalt/x-dispatch/commit/71fe4ee57962eef3eb4b910a4cd88e333d6064ec))
- simplify style change handling to prevent crashes ([6dc559e](https://github.com/lyestarzalt/x-dispatch/commit/6dc559ec11422bd979835f582e59c9963824902e))
- allow X-Plane internal airport IDs up to 7 chars ([f5b6369](https://github.com/lyestarzalt/x-dispatch/commit/f5b63691ece1e84192ceed0189b73ac716475a4c))
- add tooltip to disabled Launch button ([ae01089](https://github.com/lyestarzalt/x-dispatch/commit/ae0108972f6cb9c1c9df11f04e636a83317d9d7f))
- restructure top bar and sidebar positioning ([98c4722](https://github.com/lyestarzalt/x-dispatch/commit/98c472259d4ca03054077c928c5f94a8c9149e8e))
- restore CompassWidget and fix positioning ([e284fc5](https://github.com/lyestarzalt/x-dispatch/commit/e284fc53276d9c8cb16459cdaadfed092e03b110))
- improve CIFP parsing for SID/STAR/Approach accuracy ([650c20b](https://github.com/lyestarzalt/x-dispatch/commit/650c20bc71cddcdfe086c5328cfbd9c6b1943d93))
- restore ExplorePanel and fix route antimeridian crossing ([13112aa](https://github.com/lyestarzalt/x-dispatch/commit/13112aa83a573e0002832567d790e840790a4498))
- ensure counter-clockwise winding for GeoJSON polygons ([9f2cc17](https://github.com/lyestarzalt/x-dispatch/commit/9f2cc17332c89b47da3c25e3095942ce252e5a0a))
- filter out antimeridian-crossing polygons ([fd1713e](https://github.com/lyestarzalt/x-dispatch/commit/fd1713e3c75d8d25d247b4ef408e49b9c3ed0fe8))
- add cache-busting param to shields.io badges ([e4a3271](https://github.com/lyestarzalt/x-dispatch/commit/e4a3271b2ce76c329b2f26485bccd2d5cc26ef81))

### Documentation

- add open source community templates ([09edf91](https://github.com/lyestarzalt/x-dispatch/commit/09edf917c8dd589092240324e6fe2dbe4657fa1d))
- add Discord badge, tech stack badges, and support section ([4700fc7](https://github.com/lyestarzalt/x-dispatch/commit/4700fc7c7f2ce898aaf84bddf4de7fecdccb2025))
- add flight plan screenshot to README ([f779573](https://github.com/lyestarzalt/x-dispatch/commit/f7795733a4b35bf15e7c4717c891f6c80b2c6e4c))

### Features

- add flight plan loading and nav layer consolidation ([c1da4ed](https://github.com/lyestarzalt/x-dispatch/commit/c1da4ede537caf88b4cf85cdfce0353fce75ff3d))
- add follow mode for plane tracking ([d29e6d3](https://github.com/lyestarzalt/x-dispatch/commit/d29e6d37691f6f6f0f8afc07daafc97f2937afc4))
- add Sentry error tracking integration ([a2d4e19](https://github.com/lyestarzalt/x-dispatch/commit/a2d4e198d3053064c94a77d22f7a339e850c97db))
- enrich waypoints with nav database info ([ae30143](https://github.com/lyestarzalt/x-dispatch/commit/ae30143a4fce04314fef68dd15de72f3c9b07304))
- integrate metar-taf-parser library for proper METAR decoding ([878fb74](https://github.com/lyestarzalt/x-dispatch/commit/878fb746f73188185314934a6a70b00a712240ca))
- add translations for toolbar tooltips and airport panel ([5a93879](https://github.com/lyestarzalt/x-dispatch/commit/5a93879a922874ee63bffb49bfeafcb1aa07a479))
- custom airport markers and navigation fixes ([aea0524](https://github.com/lyestarzalt/x-dispatch/commit/aea0524583e4ee0425fafea5642626f0a2163e5d))
- use pin beacon icon for custom airports ([2705a6c](https://github.com/lyestarzalt/x-dispatch/commit/2705a6c2020fd36c7eb7b7067b8e23c03e7116e2))
- improve flight config UI and require start position ([bffaf43](https://github.com/lyestarzalt/x-dispatch/commit/bffaf43fdd23e8afa2d5ac612f01525e7fb14bb4))
- add production support logging for user diagnostics ([f7eda5c](https://github.com/lyestarzalt/x-dispatch/commit/f7eda5c04126aeac9e65c38662dcc57d3e6b5737))
- add opt-out crash reporting toggle in settings ([4256210](https://github.com/lyestarzalt/x-dispatch/commit/4256210a184824592d2de8742a4c6004abe9b770))

### Miscellaneous

- add Sentry source maps and conventional changelog ([7a9969b](https://github.com/lyestarzalt/x-dispatch/commit/7a9969bad13ffe51c6469cbfe67794744ace08fc))
- update Sentry config with env vars for org/project ([c5a733f](https://github.com/lyestarzalt/x-dispatch/commit/c5a733f650fe4637ba19913b3014aed8aa5526ae))

### Refactor

- consolidate navigation types with proper enums ([68a2c76](https://github.com/lyestarzalt/x-dispatch/commit/68a2c761e605f13355565c69db0a254c8d868af3))
- improve FlightPlanBar layout and interactions ([28a9173](https://github.com/lyestarzalt/x-dispatch/commit/28a9173f75ec4a11262505590fcbaaaa783a9b7d))
- rename Sidebar to AirportInfoPanel and remove FlightPlanTab ([e3446e7](https://github.com/lyestarzalt/x-dispatch/commit/e3446e77a7d66cf6a9841aa5e7c7cb4a90b033ea))
- remove wind indicator, keep only heading ([0a1c747](https://github.com/lyestarzalt/x-dispatch/commit/0a1c7472b37f276328c23a63418cf916fc3643af))
- redesign AirportInfoPanel with better info hierarchy ([d6a4cc3](https://github.com/lyestarzalt/x-dispatch/commit/d6a4cc38665c7e95b770fc584a6e001f61ead484))
- redesign aircraft preview with livery navigation ([3c75994](https://github.com/lyestarzalt/x-dispatch/commit/3c75994ec66631dd34ed8b60ae9b0f9ce2a8836a))
## v0.9.4 - 2026-02-19

### Bug Fixes

- improve launch logging and folder picker reliability ([8866d5c](https://github.com/lyestarzalt/x-dispatch/commit/8866d5c5a367c29ab83eddc929e33e688f32fcc6))
## v0.9.3 - 2026-02-19

### Bug Fixes

- preserve user preferences when writing Freeflight.prf ([e9456a4](https://github.com/lyestarzalt/x-dispatch/commit/e9456a438fda22998109b2656e5eec1fead3ecc4))
- include ws and related packages in build ([6684aeb](https://github.com/lyestarzalt/x-dispatch/commit/6684aeb7a13d8463c0816cf65381f9a74cd9962d))
- prevent database closing on macOS window close ([d7057e1](https://github.com/lyestarzalt/x-dispatch/commit/d7057e1af40643d580b74e9400c27f04f569f2b6))

### Features

- parse startup location metadata (row code 1301) ([4dd1041](https://github.com/lyestarzalt/x-dispatch/commit/4dd104101fbf4b173fe85b7cd2af38289606b515))
- use precise coordinates for REST API ramp spawning ([f0a6863](https://github.com/lyestarzalt/x-dispatch/commit/f0a686357bb2ae74cb4786f7d20c6dd7fb3d47a7))

### Miscellaneous

- add TODO comments for freeflightGenerator refactoring ([de61c63](https://github.com/lyestarzalt/x-dispatch/commit/de61c634b4fb1291c34cd6849aa2b783a93a507d))

### Refactor

- extract launch execution logic to dedicated executor module ([03a5104](https://github.com/lyestarzalt/x-dispatch/commit/03a51046cc6c1b8a2ddfa650c7cac09cb2bb5043))
## v0.9.2 - 2026-02-19

### Bug Fixes

- package electron-squirrel-startup for Windows builds ([ea9eb33](https://github.com/lyestarzalt/x-dispatch/commit/ea9eb332d8358b2d613a57b8bcfdd65573aec9e4))
## v0.9.1 - 2026-02-18

### Refactor

- architecture overhaul with TanStack Query, centralized types, and spawn fixes (#24) ([800544f](https://github.com/lyestarzalt/x-dispatch/commit/800544f02f06dd2c8710872d99da4cb913d4f631))
## v0.9.0 - 2026-02-13

### Documentation

- update screenshots to reflect new UI ([e905f30](https://github.com/lyestarzalt/x-dispatch/commit/e905f30ffa6ce0196f6a44a7c73acd5399fa4f93))
## v0.7.0 - 2026-02-07

### Bug Fixes

- add barIndex for approach lights and extract surface types ([f605128](https://github.com/lyestarzalt/x-dispatch/commit/f605128ff9e8550519a9450ede6351aa21998571))
- fix bezier curve parsing for smooth pavements ([7635ddd](https://github.com/lyestarzalt/x-dispatch/commit/7635ddd66c2468648c6bdc1b797ffd96c62dc878))
- render shoulders with default width when not specified ([e9a0abb](https://github.com/lyestarzalt/x-dispatch/commit/e9a0abbae1c08d8961a91930bb17e27363630c95))
- airport lines not rendred properly ([dfff5c8](https://github.com/lyestarzalt/x-dispatch/commit/dfff5c8362998f3663cb6302832b75672db75a48))
- improve label readability with line placement ([a62ea47](https://github.com/lyestarzalt/x-dispatch/commit/a62ea479b7169faaa53316e5036c3f21e41f7147))
- CSP, sign scaling, and sign parsing issues ([99e4ba3](https://github.com/lyestarzalt/x-dispatch/commit/99e4ba3ef92d1bf11d6d64fadcf69c8f587ede6a))
- use constant icon size and trigger repaint after image load ([e703231](https://github.com/lyestarzalt/x-dispatch/commit/e703231eae8bd6e23327a8e1e151935533afc6bf))
- pre-generate all sign images before adding layer ([3f4fcd4](https://github.com/lyestarzalt/x-dispatch/commit/3f4fcd41b7c104658a2e2210401a96c090e34f19))
- sync Aircraft interface in preload.ts with launcher types ([2572555](https://github.com/lyestarzalt/x-dispatch/commit/2572555b2487e7e28c3a44ef54488a7dde162286))

### Documentation

- add sign layer redesign spec ([5bd31ec](https://github.com/lyestarzalt/x-dispatch/commit/5bd31ec630324fc00746a67cf988ba872b3ddd02))
- add apt.dat cache invalidation design ([0dbf129](https://github.com/lyestarzalt/x-dispatch/commit/0dbf129512098fe947d2a6a4e9206770f60589c0))
- add implementation plan for apt.dat cache ([b541143](https://github.com/lyestarzalt/x-dispatch/commit/b541143134cbd48020d24c79df7fd3e51a997bbd))

### Features

- render airport signs as proper SVG rectangles ([45a90b4](https://github.com/lyestarzalt/x-dispatch/commit/45a90b4e64e46f180e4e8ea58e48078ee9a5df09))
- add helipad, beacon, and tower layers ([371b1ee](https://github.com/lyestarzalt/x-dispatch/commit/371b1eebce8e6580918cc7688dc08730b8a6b7b7))
- X-Plane design system overhaul and unit preferences ([e7b87c7](https://github.com/lyestarzalt/x-dispatch/commit/e7b87c78915707a07bff7d80dae8026e4743c02e))
- load React DevTools in development mode ([850b472](https://github.com/lyestarzalt/x-dispatch/commit/850b472c2a2c557f82e57756f248dc8c6a9d342b))
- add aptFileMeta table and airport metadata columns ([ca036a0](https://github.com/lyestarzalt/x-dispatch/commit/ca036a0d12c5474f0c918ebe2878135b25fb273d))
- update table creation for new schema ([b4989cd](https://github.com/lyestarzalt/x-dispatch/commit/b4989cde4098ce1a4b79971487a4e7d34dcb83fb))
- add types for apt.dat parsing ([ca9c86a](https://github.com/lyestarzalt/x-dispatch/commit/ca9c86a2579dcb30977a001b907b19d3d8794142))
- add file mtime checking for cache invalidation ([af08750](https://github.com/lyestarzalt/x-dispatch/commit/af087507a0ba49f8e5e1a86ee9007391549d6987))
- extract 1302 metadata during apt.dat parsing ([304cb74](https://github.com/lyestarzalt/x-dispatch/commit/304cb74c0f4eccf253e3a46a5eedcf3e241247a7))
- implement batch inserts and cache checking ([3abd2cb](https://github.com/lyestarzalt/x-dispatch/commit/3abd2cb26a1416f246c170acd6320c496b7d6c10))
- update clear to also clear aptFileMeta ([ad49488](https://github.com/lyestarzalt/x-dispatch/commit/ad49488ad80713b54fef219b281b163052134a01))
- Add Explore feature for discovering airports and routes (#14) (#15) ([e867926](https://github.com/lyestarzalt/x-dispatch/commit/e867926237ea396f8568c06ec2c36dc1103be459))

### Miscellaneous

- remove unused MORA and MSA layer code ([5c16639](https://github.com/lyestarzalt/x-dispatch/commit/5c1663938312e65415a9462081d439b8fac68c16))
- disable sign layer temporarily ([6c4e68f](https://github.com/lyestarzalt/x-dispatch/commit/6c4e68fb1e10d1e8459a365b3d437ce83e9cedbd))

### Refactor

- standardize map layers with class-based architecture ([ad53489](https://github.com/lyestarzalt/x-dispatch/commit/ad534898c942da3992cf18b3678992025130fd5f))
- consolidate config and remove legacy exports ([c90e53c](https://github.com/lyestarzalt/x-dispatch/commit/c90e53cbd28fc0e6417802acfc1d5deb8f062970))
- use text labels instead of SVG images, fix CSP for Google Fonts ([5b6f3c1](https://github.com/lyestarzalt/x-dispatch/commit/5b6f3c17295fa9990749bef396aaee95b0c1972d))
## v0.6.1 - 2026-02-03

### Miscellaneous

- fix repo URLs and add macOS install note (#10) ([440fb3c](https://github.com/lyestarzalt/x-dispatch/commit/440fb3c21d53d37c3b580656b747b2597ff97324))
- shadcn components, semantic colors, Map refactor & compass redesign  (#11) ([17db16f](https://github.com/lyestarzalt/x-dispatch/commit/17db16f2c2a98a9461be69cfbd63a3a96d7aacd9))
## v0.6.0 - 2026-02-02

### Documentation

- enhance README with logo and screenshots ([af08967](https://github.com/lyestarzalt/x-dispatch/commit/af08967bfb7bb6a4e330993b93762d9a3085d8dc))
- enhance README with logo and screenshots (#5) ([4a01c32](https://github.com/lyestarzalt/x-dispatch/commit/4a01c32288a5ed67119256f250fe2f4547f61292))

### Features

- add cold & dark and system time options ([6af3a33](https://github.com/lyestarzalt/x-dispatch/commit/6af3a3322136565f5f8689fec1f6adf10905fb7c))
- add cold & dark and system time options (#9) ([5861ce2](https://github.com/lyestarzalt/x-dispatch/commit/5861ce2e2fb8a15b8130bd02276a202daad7b7ea))

### Miscellaneous

- change license (#6) ([d2ece52](https://github.com/lyestarzalt/x-dispatch/commit/d2ece522274ff0f99bba6290cc749ebc4171f19d))
## v0.5.3 - 2026-02-02

### Bug Fixes

- hide menu bar and disable devtools in production ([799df0a](https://github.com/lyestarzalt/x-dispatch/commit/799df0af64390a5166c9e98c5eab474055cbb722))

### Features

- add Dependabot configuration ([c9e3755](https://github.com/lyestarzalt/x-dispatch/commit/c9e37553ee8b5780b85d65a1de2ab802d953c863))

### Refactor

- simplify release workflow ([6e24b15](https://github.com/lyestarzalt/x-dispatch/commit/6e24b151a28ff7a08b225502fde47db6358f1117))
