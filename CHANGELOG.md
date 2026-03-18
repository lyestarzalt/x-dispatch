# Changelog

All notable changes to this project will be documented in this file.
## v1.5.3 - 2026-03-18

### Bug Fixes

- remove fake DEM tile fallback that warped terrain ([df8fe4e](https://github.com/lyestarzalt/x-dispatch/commit/df8fe4e8e74c73482912fc6e6060192474fbff4b))
- open dialog defaults to current install FMS plans folder ([deb5a9f](https://github.com/lyestarzalt/x-dispatch/commit/deb5a9fe647cac4bd85b7b0781eeee68de82df21))
- prevent terrain errors on style change and low zoom ([0c63d73](https://github.com/lyestarzalt/x-dispatch/commit/0c63d7393d13a8d3db2566e72b49208597d155d2))
- remove minzoom from DEM sources that broke terrain mesh ([68b2f78](https://github.com/lyestarzalt/x-dispatch/commit/68b2f78e8fb5cf0a0c100aaa9994e546c6ee8be9))
- add min-w-0 to addon manager content area ([4f97176](https://github.com/lyestarzalt/x-dispatch/commit/4f9717668713f713001d7129ed55217c52964e89))
- replace style.load race condition with getStyle guard ([0627392](https://github.com/lyestarzalt/x-dispatch/commit/06273920c3436f2f9df3937135d05ac45132153a))

### Documentation

- update CHANGELOG.md for v1.5.2 ([26828ca](https://github.com/lyestarzalt/x-dispatch/commit/26828ca2d5afce2c4af73e40ffa4869993467127))
- rewrite README with complete feature inventory ([91e0a27](https://github.com/lyestarzalt/x-dispatch/commit/91e0a27d600c2175b64150918be4bc431504f772))

### Features

- remember last livery per aircraft ([341e9b5](https://github.com/lyestarzalt/x-dispatch/commit/341e9b527012caf2ef64febf3cd8b1bd80e1745e))
- add version bump and Discord notification to RC workflow ([eb726e8](https://github.com/lyestarzalt/x-dispatch/commit/eb726e84f29ed1438c1dbd6736c6c337b8acdc3d))
- add interface zoom control and fix launch dialog layout ([c5764e4](https://github.com/lyestarzalt/x-dispatch/commit/c5764e4deae5af3ab925deddeec91c3b6059c0d7))
- remember last aircraft per type filter and improve star visibility ([f6ebc5e](https://github.com/lyestarzalt/x-dispatch/commit/f6ebc5e9bd7645bbfeaeaf82811eeb5a9559d5b1))

### Refactor

- use transformStyle to preserve layers across basemap switches ([af2f6c3](https://github.com/lyestarzalt/x-dispatch/commit/af2f6c36ee999ae06a124ef35e36e0d66d8d9dff))
## v1.5.2 - 2026-03-16

### Bug Fixes

- wrap installation name in brackets in window title ([a1eaf09](https://github.com/lyestarzalt/x-dispatch/commit/a1eaf09b0e9459873986fa8e27668aeeb7b24323))
- prevent terrain disappearing after zoom out, add dev debug overlay ([8928eb7](https://github.com/lyestarzalt/x-dispatch/commit/8928eb79006de99406c453fc18665aaec18c5372))
- always rescan addon and aircraft lists on dialog open ([8487f1c](https://github.com/lyestarzalt/x-dispatch/commit/8487f1cae91ff673b753d442ba9a93aa3efe032e))

### Documentation

- update CHANGELOG.md for v1.5.1 ([cf0419f](https://github.com/lyestarzalt/x-dispatch/commit/cf0419ffd29e39795de1d93a5c723398815a4943))

### Features

- add setting to toggle idle orbit camera, default off ([6275e00](https://github.com/lyestarzalt/x-dispatch/commit/6275e006ad50bfcc66dd9a0de775106814240e52))
- add multi X-Plane installation support ([2abf427](https://github.com/lyestarzalt/x-dispatch/commit/2abf4278622ba1d1b16da1413dd90f897ddd1ee1))
## v1.5.1 - 2026-03-15

### Bug Fixes

- include arch in Windows and Linux binary names ([6c79f77](https://github.com/lyestarzalt/x-dispatch/commit/6c79f77b91c83fe6108c8b2f4b186f996ae1f4ad))
- validate airport cache on startup before marking as loaded ([6ae5679](https://github.com/lyestarzalt/x-dispatch/commit/6ae5679f24136a5e98e60ffd9f324116178f1bda))
- place fuel in correct X-Plane tank slot for third-party aircraft ([c228bfd](https://github.com/lyestarzalt/x-dispatch/commit/c228bfdc260ed8e8c3e1c58a089204c8c859439d))
- harden scenery detection and improve addon manager UI ([6dabc3a](https://github.com/lyestarzalt/x-dispatch/commit/6dabc3abdc2734a40e22e0ee003eb551c9592c9c))
- exclude AI traffic .acf files from aircraft scanner ([a21a6a2](https://github.com/lyestarzalt/x-dispatch/commit/a21a6a2cea0391bd182cf92ef4b4b54ee83c2179))
- allow backslash in aircraft folder paths for livery scanning ([e984d7d](https://github.com/lyestarzalt/x-dispatch/commit/e984d7d8ba3e913f83a1230005469d69fd90976f))
- prevent terrain crashes on globe projection and silence DEM errors ([39b7470](https://github.com/lyestarzalt/x-dispatch/commit/39b74705b00d17697ee3096e6a0c3d08ee5ead16))

### Documentation

- update CHANGELOG.md for v1.5.0 ([9e6d22b](https://github.com/lyestarzalt/x-dispatch/commit/9e6d22b02548f229e7b261d2d50f0d8a99a4643d))
- update Discord invite link ([dbdffbd](https://github.com/lyestarzalt/x-dispatch/commit/dbdffbd1e9fa30e2382e29da803c2eae82526188))

### Features

- toggle deselect for gates, runway ends & helipads ([8136be8](https://github.com/lyestarzalt/x-dispatch/commit/8136be850c6a9a1ba0b2803cc95850cb8c520c20))
- add disk tile cache for MapLibre ([d8b821d](https://github.com/lyestarzalt/x-dispatch/commit/d8b821d71bdc888720fd5e91004d5987f2dba2cd))
- add hillshade and contour lines to terrain visualization ([3bf967f](https://github.com/lyestarzalt/x-dispatch/commit/3bf967fb3833a38e909415fae661d8594bbb36e4))
- add idle orbit camera around selected airport ([e0d5e4c](https://github.com/lyestarzalt/x-dispatch/commit/e0d5e4cd8346bb798ec0d83e3e40b8ea96566327))
- add terrain shading toggle to toolbar overlays ([d9149ee](https://github.com/lyestarzalt/x-dispatch/commit/d9149ee02631d8705f6a5630875587e506ac537e))
- add close-on-launch option, remove networks tab ([e4579d6](https://github.com/lyestarzalt/x-dispatch/commit/e4579d64f130f70c77a7dde3360873bf3ef1ffdf))
- display app version in title bar ([bddfc49](https://github.com/lyestarzalt/x-dispatch/commit/bddfc49cd686c9ff1361bd9ba46cb031529d21f8))
- add two-phase loading screen with granular airport progress ([7f8650a](https://github.com/lyestarzalt/x-dispatch/commit/7f8650aef3fea2b9882e0223c95a8d1c0fc77687))
- detect symlinked scenery packs in Custom Scenery folder ([05dd57d](https://github.com/lyestarzalt/x-dispatch/commit/05dd57dcfbbc519bce3c13e3d4644fc2507e0a50))
- redesign app icon and inline SVG logo component ([f436dc2](https://github.com/lyestarzalt/x-dispatch/commit/f436dc274ac815c0a8a0d61b03ffb0f69b3c07d6))

### Miscellaneous

- add dbCredentials to drizzle config for Drizzle Studio ([82c1814](https://github.com/lyestarzalt/x-dispatch/commit/82c18140a32e7f37894665c9a7944ba21c584e13))

### Wip

- scaffold 3D glide slope visualization (disabled) ([2153dff](https://github.com/lyestarzalt/x-dispatch/commit/2153dffc80ff424fd4136425d092089da5fa7180))
## v1.5.0 - 2026-03-12

### Bug Fixes

- add forwardRef to Badge component ([063c025](https://github.com/lyestarzalt/x-dispatch/commit/063c025ba2c9331102ec9671af64e5f2bf3c9dba))
- correct ref types and add missing forwardRef in shadcn components ([2875eeb](https://github.com/lyestarzalt/x-dispatch/commit/2875eebb265e995b506e452de330beb47d84553e))
- derive fuel tank ratios from _cgpt capacity for third-party helicopters ([754b3b0](https://github.com/lyestarzalt/x-dispatch/commit/754b3b0a99762ec35bf3c686cc6b54b6dec3a981))
- skip --version on Windows Steam to avoid launch dialog ([05fba79](https://github.com/lyestarzalt/x-dispatch/commit/05fba7943a994adad41750bd9b754def4eda8191))
- correct fuel tank count for third-party aircraft ([640d1ad](https://github.com/lyestarzalt/x-dispatch/commit/640d1adace251928138dd8d01d7522b1d243463b))
- improve fuel parsing and add payload fallback for third-party aircraft ([710cc82](https://github.com/lyestarzalt/x-dispatch/commit/710cc82cd8070f3682d9812a5bbfa245dbca3940))
- adjust sun arc horizon line based on day length ([66c7560](https://github.com/lyestarzalt/x-dispatch/commit/66c756067fc1c57578db75b21d947437c700a7ef))
- persist aircraft path instead of full object to prevent stale livery/config ([ee2a562](https://github.com/lyestarzalt/x-dispatch/commit/ee2a562b8e6ab1071d986bc0a944fe7f98d8c6e4))
- clear selected procedure when flight plan is removed ([45caaf6](https://github.com/lyestarzalt/x-dispatch/commit/45caaf6e594e36e6014f2b934d779944b7f72341))
- replace deferred layer removal with synchronous getStyle guard ([9166bb2](https://github.com/lyestarzalt/x-dispatch/commit/9166bb283e080201ccc5a6e29d43708eabffa4b3))
- invalidate launcher aircraft cache after addon mutations ([e0666fd](https://github.com/lyestarzalt/x-dispatch/commit/e0666fdab09591ece1f61177c6c173d0f5d8ac95))

### Documentation

- update CHANGELOG.md for v1.4.1 ([b94c99a](https://github.com/lyestarzalt/x-dispatch/commit/b94c99a09897740e88a158038561371198da1b8d))

### Features

- redesign WeatherDialog with interactive altitude diagram ([746b0f3](https://github.com/lyestarzalt/x-dispatch/commit/746b0f3772203dc04109563334428a2e16bb9daa))
- add environment controls, i18n, and fix dialog sizing ([b1be774](https://github.com/lyestarzalt/x-dispatch/commit/b1be774a833e3705bed99c11573e8e078b54db7f))
- add day/night terminator overlay ([92c68e7](https://github.com/lyestarzalt/x-dispatch/commit/92c68e7b0948fa096481b03b0978d55b80e5f5eb))
- add range rings layer for aircraft category reach visualization ([3281880](https://github.com/lyestarzalt/x-dispatch/commit/32818802ba4a970a9f7c743b14dcb9f37950e468))
- add pin-drop custom start location ([b40174a](https://github.com/lyestarzalt/x-dispatch/commit/b40174a77304f1ca02434dc213b1ca249ece2eda))
- persist aircraft list filters across sessions ([349ba19](https://github.com/lyestarzalt/x-dispatch/commit/349ba19a42628f0ee3aeb3c887a7e044a4092f4e))
- render aircraft silhouettes for VATSIM/IVAO traffic ([8787439](https://github.com/lyestarzalt/x-dispatch/commit/8787439289ba336c77edfd427736842e7f97cbc7))
- redesign player aircraft icon with canvas-based rendering ([1269e92](https://github.com/lyestarzalt/x-dispatch/commit/1269e92d914e49015ea8be4246ff5a6ae5225c60))
- detect aircraft category from X-Plane metadata datarefs ([090546c](https://github.com/lyestarzalt/x-dispatch/commit/090546c83d49276dd064e60515d5cbff77e76605))
- redesign with grouped layout, color-coded values, drag-to-reposition & new datarefs ([72b7156](https://github.com/lyestarzalt/x-dispatch/commit/72b7156016723f4f64093d1f7575e1f89a12f514))
- save last 10 launches with browse & restore ([37dee95](https://github.com/lyestarzalt/x-dispatch/commit/37dee95297cdf841515058e22cbef6b69aebe9de))

### Miscellaneous

- add separate mac arm64/x64 builds and rename artifacts ([32f7722](https://github.com/lyestarzalt/x-dispatch/commit/32f772237bd0e5f8835618584a87e16f4a63dc4b))

### Refactor

- clean up LoadingScreen design system usage and dead code ([ed1873f](https://github.com/lyestarzalt/x-dispatch/commit/ed1873fec11da2122a5f0075cd6f85b05dee5b7b))
- add categorical color tokens to design system ([7dc7628](https://github.com/lyestarzalt/x-dispatch/commit/7dc7628ea96b5e9c13c633eafc81b3bb57999059))
- convert remaining hardcoded colors to design system tokens ([6c908b8](https://github.com/lyestarzalt/x-dispatch/commit/6c908b828ca9f40888527ec22d33beafc0954609))
- use correct shadcn/ui components for tabs, toggles, and buttons ([4e31591](https://github.com/lyestarzalt/x-dispatch/commit/4e31591116a4a27c4aff1056cd82d4b8dfba6162))
- centralize Badge variants, Button tooltips, and Spinner component ([019a4fd](https://github.com/lyestarzalt/x-dispatch/commit/019a4fdc363bb61da6c800f0a1c0ba970c6a7f61))
- add Input icon slots, improve FlightConfig layout and token usage ([315d102](https://github.com/lyestarzalt/x-dispatch/commit/315d1024b41a3770de46960cd2e918081e95d08d))
- replace ad-hoc reconnect with state machine, backoff & keepalive ([38faca3](https://github.com/lyestarzalt/x-dispatch/commit/38faca3839c3763bc7288d8b754ab52d444dda39))
## v1.4.1 - 2026-03-06

### Bug Fixes

- prevent empty object rendering in VerticalProfile tooltip ([06bcda7](https://github.com/lyestarzalt/x-dispatch/commit/06bcda779b3026c7087fb05a8f65c96cb985e85f))
- handle CRLF line endings and missing tank names in ACF parser ([51d8d16](https://github.com/lyestarzalt/x-dispatch/commit/51d8d16f65c116336afe4010f512df7e1d4d6742))
- always detect .acf as aircraft regardless of nesting ([0f78da9](https://github.com/lyestarzalt/x-dispatch/commit/0f78da9ccd3f84886598ac7770ec78be445d3354))
- resolve 7zip binary path and add alpha badge ([42f20e6](https://github.com/lyestarzalt/x-dispatch/commit/42f20e6a34552a74be00826cdb3b4a917ae0785f))
- switch ramp spawn from lle_ground_start to ramp_start ([9a9f22e](https://github.com/lyestarzalt/x-dispatch/commit/9a9f22ed11b924551ae0d1dfa2fe8fc1376c2ac0))
- update existing sources when switching airports ([e64ae55](https://github.com/lyestarzalt/x-dispatch/commit/e64ae552d40e7d51e2204fa360d40cb6a240c04d))
- handle Windows file lock when deleting stale database ([d7b97f6](https://github.com/lyestarzalt/x-dispatch/commit/d7b97f648f5667ac472da934195506df54e5ca56))
- skip renderer error reporting in development ([39ee519](https://github.com/lyestarzalt/x-dispatch/commit/39ee5190f53a33d814d13d4f82c9158b262fcd75))

### Documentation

- update CHANGELOG.md for v1.4.0 ([eefdff9](https://github.com/lyestarzalt/x-dispatch/commit/eefdff95be6e11f78416d8ddc8e748364c8ef2a1))

### Features

- add country and surface type airport filters ([044d1d3](https://github.com/lyestarzalt/x-dispatch/commit/044d1d3d0c20f8bd2b3865ffff9a57fe5424b0f2))
- detect and store exact X-Plane version ([c7aa4bc](https://github.com/lyestarzalt/x-dispatch/commit/c7aa4bc4ea8a9a62c5eb7ed94c69a9a00cda86f4))
- detect and display newer Gateway scenery releases ([94c688d](https://github.com/lyestarzalt/x-dispatch/commit/94c688de994fd5c7d656c71e1635b883bc844ad4))

### Miscellaneous

- add Gilles to credits as special thanks for testing ([13a317f](https://github.com/lyestarzalt/x-dispatch/commit/13a317f7c2a52ad05fe26f7ed5b1d947ca28f3bc))
- add emojis to README and gitignore design system files ([5200700](https://github.com/lyestarzalt/x-dispatch/commit/5200700ed3e1a3eeedf39eaa2ac2edcd2e1a443e))
## v1.4.0 - 2026-03-03

### Bug Fixes

- add null guards for external API data ([3e5c076](https://github.com/lyestarzalt/x-dispatch/commit/3e5c076e5a9edb86005aab9189de204d298f4ced))

### Documentation

- update CHANGELOG.md for v1.3.2 ([8c8fceb](https://github.com/lyestarzalt/x-dispatch/commit/8c8fcebafeda27db84361f09b0230119a0476c4f))

### Features

- add IVAO online network support with mutual exclusivity ([19d3fb6](https://github.com/lyestarzalt/x-dispatch/commit/19d3fb6876825dc7dcf351fd5d13c79bbb4f021f))
- add Weight, Balance & Fuel dialog with per-tank fuel and payload stations ([c76112e](https://github.com/lyestarzalt/x-dispatch/commit/c76112ebf8c7db9657605f7351cfd3774e9d1cd8))
- add weather customization with presets and custom mode ([4ecd3cd](https://github.com/lyestarzalt/x-dispatch/commit/4ecd3cdfd7fbb5431f62578328e33e688fe95c71))
- replace SunArc with visual celestial arc component ([2180918](https://github.com/lyestarzalt/x-dispatch/commit/21809180e045ef2fab2771da864c882c7b1ac08b))

### Refactor

- clean up FlightConfig sidebar layout ([ae2f66f](https://github.com/lyestarzalt/x-dispatch/commit/ae2f66f4307911eb7e095bd100d42b53a306890c))
## v1.3.2 - 2026-03-03

### Bug Fixes

- improve MapLibre error logging and SVG icon loading ([e45f39e](https://github.com/lyestarzalt/x-dispatch/commit/e45f39e0d566eeaec9d8284e215bf313c22d6cd7))
- user-friendly error for EPERM in protected X-Plane folders ([36f3d94](https://github.com/lyestarzalt/x-dispatch/commit/36f3d94a5363792892dc1a69a9c49ad7fbd3d8dd))
- guard against non-string NOTAM and SIGMET fields ([f799cc4](https://github.com/lyestarzalt/x-dispatch/commit/f799cc4ca1410e01e1d0289acf2ad6cd2a4d90df))
- guard against NaN coordinates in fitMapToFlightPlan ([be26180](https://github.com/lyestarzalt/x-dispatch/commit/be261805470f3795dc18da7f7621f32a84e9e88b))
- preserve unrecognized lines in Freeflight.prf ([cf5cc34](https://github.com/lyestarzalt/x-dispatch/commit/cf5cc3438ff2d3e183dfb16f570256c92d61ac3b))
- preserve scenery_packs.ini order and disable by default ([abe9377](https://github.com/lyestarzalt/x-dispatch/commit/abe93770b540421da081ecf192bf0491187bd8e6))
- normalize bearing to 0-360 instead of -180 to 180 ([beea761](https://github.com/lyestarzalt/x-dispatch/commit/beea76156d368a312064d5ff8d7be9f13f0aebc3))

### Documentation

- update CHANGELOG.md for v1.3.1 ([219c29c](https://github.com/lyestarzalt/x-dispatch/commit/219c29ca7e03e00febd7cdf4a6bf8418fba504d4))

### Miscellaneous

- upgrade maplibre-gl to ^5.19.0 ([31dec6d](https://github.com/lyestarzalt/x-dispatch/commit/31dec6d332fa2a382763ec442274d02ee49b1288))
- add TODO for --no_save_prefs user settings issue ([061580a](https://github.com/lyestarzalt/x-dispatch/commit/061580adf476c4edb432c793a194ff530090548b))
- add TODO for pgrep false positive on macOS ([f9cc84e](https://github.com/lyestarzalt/x-dispatch/commit/f9cc84e71eb5c1bb1013fc1f552b729769192914))

### Refactor

- consolidate 12 items into 7 for narrow-screen support ([56583b2](https://github.com/lyestarzalt/x-dispatch/commit/56583b2edc2c2bcfe34478e22f0e880a7b369b16))
- use FlightInit JSON for cold start instead of Freeflight.prf ([03b81ff](https://github.com/lyestarzalt/x-dispatch/commit/03b81ff5eda41c74a42762f7ade7079ceaa0b112))
- move addon manager from settings to toolbar ([2dafc48](https://github.com/lyestarzalt/x-dispatch/commit/2dafc484c3dcaf7f201a09909cb03f19bf40472a))
- always show in toolbar and indicate order is preserved ([9e4c9e5](https://github.com/lyestarzalt/x-dispatch/commit/9e4c9e59c0f294db0a3ad2f898f04cd703ad2cc8))
## v1.3.1 - 2026-03-01

### Bug Fixes

- defer layer removal when MapLibre is mid-render ([3b7ad64](https://github.com/lyestarzalt/x-dispatch/commit/3b7ad64d03c674f1b4db0b688b50541a02e98f64))
- surface real API error message instead of generic HTTP 400 ([91e52be](https://github.com/lyestarzalt/x-dispatch/commit/91e52be3c41ad486e17814c3eddc604a72e55d9d))
- fix taxiway name layer interpolation and visibility ([8bf1e79](https://github.com/lyestarzalt/x-dispatch/commit/8bf1e79efd4d73a3b0ca78a5182ece82a019f2df))
- sanitize API response to handle empty objects ([5d2bd71](https://github.com/lyestarzalt/x-dispatch/commit/5d2bd71393d9580e0436acd425436e160ceba792))
- terrain DEM maxzoom and SimBrief array coercion crashes ([b0aed02](https://github.com/lyestarzalt/x-dispatch/commit/b0aed02e71ae4cd8e7eb0f6844aadc430d12d49e))
- fix source map uploads and VerticalProfile crash ([0805250](https://github.com/lyestarzalt/x-dispatch/commit/0805250c758a22be000cd8697b4c55368f81a782))
- tell user to generate a flight plan on simbrief.com first ([b24ddb1](https://github.com/lyestarzalt/x-dispatch/commit/b24ddb15087599e9f4c041cb09873836ce16d7b3))

### Documentation

- update CHANGELOG.md for v1.3.0 ([af9842a](https://github.com/lyestarzalt/x-dispatch/commit/af9842a7fd0fdb63a18f54e6b55a8266499d83e5))
## v1.3.0 - 2026-03-01

### Bug Fixes

- increase base text size from text-xs to text-sm across all components ([a1d9492](https://github.com/lyestarzalt/x-dispatch/commit/a1d9492b0cb460190a26affe1cc5acdd34261924))
- replace broken migration system with schema fingerprinting ([3322bc3](https://github.com/lyestarzalt/x-dispatch/commit/3322bc331bc3e4cfd23005609b295ae5b259eaf0))
- retry DB init on failure to prevent zombie app state ([9bfe1c0](https://github.com/lyestarzalt/x-dispatch/commit/9bfe1c0ac46fa94fbd9289f38ca3589b190e7448))
- harden startup against all DB failure paths ([2029349](https://github.com/lyestarzalt/x-dispatch/commit/20293494eb807eb38dade26cd4447eaec3ab2b6d))
- move window security handlers into createWindow ([889f8a4](https://github.com/lyestarzalt/x-dispatch/commit/889f8a4f47a516dced3fe8417d7832145523e880))

### Documentation

- update CHANGELOG.md for v1.2.1 ([6ac181c](https://github.com/lyestarzalt/x-dispatch/commit/6ac181cd11b3c747fac50b0fa0f4c52675f76af1))
- add Ko-fi donation badge and link ([283f2d6](https://github.com/lyestarzalt/x-dispatch/commit/283f2d63aad0233d202a6c05c6b7e3aab98f2fba))
- move macOS install notice below intro section ([e3f69e4](https://github.com/lyestarzalt/x-dispatch/commit/e3f69e4a0eaefd7c55c898e8c881c138de3a6440))
- update X-Plane requirement to 12.4+ ([b333058](https://github.com/lyestarzalt/x-dispatch/commit/b333058ae3d29d84604c7b3fabbdeef091905c06))

### Features

- add user-configurable font size (small/medium/large) ([69042ad](https://github.com/lyestarzalt/x-dispatch/commit/69042ad0db574bec43a128acf5055dc6fb270dc0))
- persist flight config across sessions ([77566f6](https://github.com/lyestarzalt/x-dispatch/commit/77566f6135806437ec6f04f5584988965b5d3d69))
- add airport dot filters (type, custom scenery) ([a5cd8cd](https://github.com/lyestarzalt/x-dispatch/commit/a5cd8cd5633faf90537874147d40d9757a77e00f))
- add taxiway name labels from taxi route network ([b975ecb](https://github.com/lyestarzalt/x-dispatch/commit/b975ecb73f3d3dc5979a8590852bf690f2084eed))
- add live weather radar overlay using RainViewer API ([52b5068](https://github.com/lyestarzalt/x-dispatch/commit/52b5068bdc9962bf31f1c2c0745efd0a846f12de))

### Refactor

- centralize zoom levels with named ZOOM_LEVEL constants ([562ae3c](https://github.com/lyestarzalt/x-dispatch/commit/562ae3c1ae40d5a10a0d645bd36c8d1ead278d53))
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
