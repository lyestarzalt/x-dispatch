# Changelog

All notable changes to this project will be documented in this file.
## v1.6.0 - 2026-03-24

### Features

- **ui:** Auto-navigate to start tab and scroll to selected item by @lyestarzalt([d440e63](https://github.com/lyestarzalt/x-dispatch/commit/d440e6355e4403dc992a75a6c7144d9135bd98a6))
- **launch:** Add runway start options — approach distance and glider tow by @lyestarzalt([c0ad28a](https://github.com/lyestarzalt/x-dispatch/commit/c0ad28a174381cc90bcdd7d7735cca609b7497bc))
- **launch:** Add air start, carrier, and frigate start modes to pin drop by @lyestarzalt([ace7f08](https://github.com/lyestarzalt/x-dispatch/commit/ace7f0845c980f23b9c7a4fdf936e1498e16db26))

### Bug Fixes

- **launch:** Persist aircraft selection under actual type, not just active filter by @lyestarzalt([9d60fe9](https://github.com/lyestarzalt/x-dispatch/commit/9d60fe9b5adb1d1cb6e1c266fda180b9ff66556b))
- **map:** Rewrite taxiway lights as MapLibre circles and fix layer crash by @lyestarzalt([eaa6989](https://github.com/lyestarzalt/x-dispatch/commit/eaa69896893d92d57005c0cc3f4e8f0d52f02c6c))
- **addons:** Follow symlinks and junctions when scanning aircraft, plugins, and liveries by @lyestarzalt([c2706a5](https://github.com/lyestarzalt/x-dispatch/commit/c2706a5a4770d97c4f37fd86e69bc2e5c94628fd))
- **data:** Don't abort scenery scan when one symlink fails by @lyestarzalt([7936d84](https://github.com/lyestarzalt/x-dispatch/commit/7936d84222beef24f4abf1b232ea7c1394eda0c8))
- **ci:** Add download links to release and changelog to RC Discord notifications by @lyestarzalt([4f20987](https://github.com/lyestarzalt/x-dispatch/commit/4f2098720b8e71d082dc04329bf64876358458cc))
- **map:** Smaller taxiway lights with radiated glow effect by @lyestarzalt([ed05188](https://github.com/lyestarzalt/x-dispatch/commit/ed0518842b397031d07a9f9364c2eca828a2dd0c))

### Refactor

- **explore:** Rework panel as collapsible side panel by @lyestarzalt([41701b0](https://github.com/lyestarzalt/x-dispatch/commit/41701b0d687d4b02fee1a948288edb959bb98887))
- **explore:** Fix event list clipping and unify ICAO colors by @lyestarzalt([b012c68](https://github.com/lyestarzalt/x-dispatch/commit/b012c685dfe4d5603d6dcc696ac7da0cc74fe8e4))
- **map:** Redesign runway end markers to match gate visual style by @lyestarzalt([827bd2e](https://github.com/lyestarzalt/x-dispatch/commit/827bd2eea151995ea752ff4c74cd1ca51ef266bc))

### Documentation

- Update CHANGELOG.md for v1.5.5 by @github-actions[bot]([450eaf5](https://github.com/lyestarzalt/x-dispatch/commit/450eaf54cb032e0da47afa9e90213c846e22a881))

### Miscellaneous

- Fix dependency vulnerabilities via npm audit fix by @lyestarzalt([351516b](https://github.com/lyestarzalt/x-dispatch/commit/351516b3052dd6a7559d3f7d744282cfc95bee46))
- **i18n:** Add runway start option translations for all locales by @lyestarzalt([f077ac6](https://github.com/lyestarzalt/x-dispatch/commit/f077ac6ec09fbad13816e19102c6af0f19735f56))
- **ci:** Standardize job and step naming across release workflows by @lyestarzalt([f470717](https://github.com/lyestarzalt/x-dispatch/commit/f470717869658678fee8943de052cb4cf1f032d8))

### Release

- 1.6.0 by @github-actions[bot]([1549c15](https://github.com/lyestarzalt/x-dispatch/commit/1549c153119378bf27e1f706453d59c797d0bc1c))


## v1.5.5 - 2026-03-22

### Documentation

- Update CHANGELOG.md for v1.5.4 by @github-actions[bot]([a95c8b4](https://github.com/lyestarzalt/x-dispatch/commit/a95c8b4fbfd2fff9b611ede297c4027589547f09))

### CI/CD

- Rewrite release workflow and changelog config by @lyestarzalt([6cdc97b](https://github.com/lyestarzalt/x-dispatch/commit/6cdc97b747af8b6d857f31425c053677728de482))
- Skip redundant Sentry source map uploads on non-Linux builds by @lyestarzalt([4c979e8](https://github.com/lyestarzalt/x-dispatch/commit/4c979e8cd1cca13f082587a0971271759f7405dd))

### Release

- 1.5.5 by @github-actions[bot]([534c837](https://github.com/lyestarzalt/x-dispatch/commit/534c83767de14eff5fa1b0fa983139e70468c9fb))


## v1.5.4 - 2026-03-22

### Features

- **toolbar:** Add coordinate input to pin drop with split button by @lyestarzalt([6d081d9](https://github.com/lyestarzalt/x-dispatch/commit/6d081d9c082887df0a58c1f596a968d6cbbfcf74))
- **addons:** Add rescan button to scenery and browser tabs by @lyestarzalt([b204c6f](https://github.com/lyestarzalt/x-dispatch/commit/b204c6f36bd8e6d86a56aed6fd6bf9d9e4fa3f23))
- **addons:** Detect manually added scenery and show rescan feedback by @lyestarzalt([441b47e](https://github.com/lyestarzalt/x-dispatch/commit/441b47ed3e230507388fb733f63b1868375fda6e))
- **map:** Interactive drag-to-resize range rings by @lyestarzalt([9f1b387](https://github.com/lyestarzalt/x-dispatch/commit/9f1b387769b307ffca051cbc30fde5d28cc594a6))
- **toolbar:** Add Ctrl+F / Cmd+F shortcut to focus airport search by @lyestarzalt([b807752](https://github.com/lyestarzalt/x-dispatch/commit/b807752be24a79398a5e4e95696cb4813923c949))
- **addons:** Show GLOBAL_AIRPORTS as draggable row with search bar by @lyestarzalt([054ff63](https://github.com/lyestarzalt/x-dispatch/commit/054ff63f3af9d9ab126902c68ca484fba6f4c3e0))
- **addons:** Add delete scenery from disk with confirmation by @lyestarzalt([bc03060](https://github.com/lyestarzalt/x-dispatch/commit/bc030602819e544c99dd15e8bd75ecf14a260ee6))
- **app:** Add xdispatch:// deep link protocol for airport navigation by @lyestarzalt([b6edcef](https://github.com/lyestarzalt/x-dispatch/commit/b6edcef8a333c6747ca861afa7ccce0ca1be5102))
- **data:** Split airports into two tables for fast custom scenery resync by @lyestarzalt([6ae904a](https://github.com/lyestarzalt/x-dispatch/commit/6ae904a47991d11399bd9eaacf99e0e21b98cb92))
- **map:** Add starfield background behind globe view by @lyestarzalt([fe574d0](https://github.com/lyestarzalt/x-dispatch/commit/fe574d0cc8f5bbbb7ad40ece87ed11bb8a46e338))

### Bug Fixes

- **ci:** Fix release notes not appearing on GitHub releases by @lyestarzalt([679b782](https://github.com/lyestarzalt/x-dispatch/commit/679b78202b59d00f29bea84a3d0454038140093f))
- **ci:** Use file-based release notes and harden workflow by @lyestarzalt([978e639](https://github.com/lyestarzalt/x-dispatch/commit/978e639f0e91bf00f69d342587b8096def13cb3b))
- **addons:** Handle cross-drive install when temp and X-Plane are on different drives by @lyestarzalt([51d0b53](https://github.com/lyestarzalt/x-dispatch/commit/51d0b53eb00f1d8a307954b0aeae49aab6ee9de3))
- **addons:** Skip deleted scenery folders instead of showing ??? by @lyestarzalt([e991d28](https://github.com/lyestarzalt/x-dispatch/commit/e991d288db70a5a63acca8d79e3b7ccaac87bdb3))
- **addons:** Remove stale scenery entries from scenery_packs.ini by @lyestarzalt([006b58a](https://github.com/lyestarzalt/x-dispatch/commit/006b58a73a88e4d1fa33248c1676d742b08cb024))
- **addons:** Fix drag-and-drop not working in installer by @lyestarzalt([1e1e687](https://github.com/lyestarzalt/x-dispatch/commit/1e1e6873b586781b5fa00d7383527abebd3590c2))
- **addons:** Sort new scenery into correct priority position in INI by @lyestarzalt([a505808](https://github.com/lyestarzalt/x-dispatch/commit/a5058080a6570ea2ab6d788667021fb4f576275a))
- **app:** Prevent multiple instances from running simultaneously by @lyestarzalt([c303804](https://github.com/lyestarzalt/x-dispatch/commit/c30380420a13a9757cb263327b9329abee6cccd3))
- **addons:** Fix landmarks misclassified as Airport by @lyestarzalt([65eaa38](https://github.com/lyestarzalt/x-dispatch/commit/65eaa388f040a95cafe68339d32ac91a1ccdce1d))
- **flightplan:** Clear old route and re-center when loading new file by @lyestarzalt([d636433](https://github.com/lyestarzalt/x-dispatch/commit/d636433e9c05c68fbdcafc359ee9a6722577d8fd))
- **ui:** Move flight plan close button to the left side by @lyestarzalt([eac02b3](https://github.com/lyestarzalt/x-dispatch/commit/eac02b3e5bf827d0f196abe0a6e061d4288bcb4e))
- **addons:** Fix rescan spinner and add missing i18n keys by @lyestarzalt([55d294e](https://github.com/lyestarzalt/x-dispatch/commit/55d294e3b7628daea45d06353cafc18112fd1319))

### Refactor

- **addons:** Simplify scenery toolbar, remove safe mode toggle by @lyestarzalt([fde3f42](https://github.com/lyestarzalt/x-dispatch/commit/fde3f425a7b4b668b7dc1dc32c9b2cd648b3c104))
- **map:** Redesign range rings with inline labels along the ring by @lyestarzalt([5aab271](https://github.com/lyestarzalt/x-dispatch/commit/5aab27138b11a51cb010cb7e1211e99b2558d6f5))
- **map:** Redesign custom airport pin to match design system by @lyestarzalt([1affcb9](https://github.com/lyestarzalt/x-dispatch/commit/1affcb9a7d63ece99b51b76d6ef1f637edf82461))
- **addons:** Polish scenery tab UI for consistency by @lyestarzalt([bba1609](https://github.com/lyestarzalt/x-dispatch/commit/bba1609be89e954cfd21abc60af8410300eac3ff))
- **addons:** Align browser tab toolbar with scenery tab design by @lyestarzalt([f91a17d](https://github.com/lyestarzalt/x-dispatch/commit/f91a17d781d93f366f123580669be32112cea8f4))
- **addons:** Remove check updates button and clean up browser tab by @lyestarzalt([db454af](https://github.com/lyestarzalt/x-dispatch/commit/db454af9141a816c38786881bb2168d32caa3516))

### Documentation

- Update CHANGELOG.md for v1.5.3 by @github-actions[bot]([2ca8ceb](https://github.com/lyestarzalt/x-dispatch/commit/2ca8ceb7e3d377363d74786d9bd37f0fbc80274b))
- Update README screenshots and add fuel, weather, terrain views by @lyestarzalt([70ab696](https://github.com/lyestarzalt/x-dispatch/commit/70ab696887e77297b0bdfbaf1333789168e449db))

### Release

- 1.5.4 by @github-actions[bot]([9774abd](https://github.com/lyestarzalt/x-dispatch/commit/9774abd8322271d9b2cc78648b9e3591b5de2db5))


## v1.5.3 - 2026-03-18

### Features

- **launch:** Remember last livery per aircraft by @lyestarzalt([341e9b5](https://github.com/lyestarzalt/x-dispatch/commit/341e9b527012caf2ef64febf3cd8b1bd80e1745e))
- **ci:** Add version bump and Discord notification to RC workflow by @lyestarzalt([eb726e8](https://github.com/lyestarzalt/x-dispatch/commit/eb726e84f29ed1438c1dbd6736c6c337b8acdc3d))
- **settings:** Add interface zoom control and fix launch dialog layout by @lyestarzalt([c5764e4](https://github.com/lyestarzalt/x-dispatch/commit/c5764e4deae5af3ab925deddeec91c3b6059c0d7))
- **launch:** Remember last aircraft per type filter and improve star visibility by @lyestarzalt([f6ebc5e](https://github.com/lyestarzalt/x-dispatch/commit/f6ebc5e9bd7645bbfeaeaf82811eeb5a9559d5b1))

### Bug Fixes

- **tileCache:** Remove fake DEM tile fallback that warped terrain by @lyestarzalt([df8fe4e](https://github.com/lyestarzalt/x-dispatch/commit/df8fe4e8e74c73482912fc6e6060192474fbff4b))
- **flightplan:** Open dialog defaults to current install FMS plans folder by @lyestarzalt([deb5a9f](https://github.com/lyestarzalt/x-dispatch/commit/deb5a9fe647cac4bd85b7b0781eeee68de82df21))
- **map:** Prevent terrain errors on style change and low zoom by @lyestarzalt([0c63d73](https://github.com/lyestarzalt/x-dispatch/commit/0c63d7393d13a8d3db2566e72b49208597d155d2))
- **map:** Remove minzoom from DEM sources that broke terrain mesh by @lyestarzalt([68b2f78](https://github.com/lyestarzalt/x-dispatch/commit/68b2f78e8fb5cf0a0c100aaa9994e546c6ee8be9))
- **layout:** Add min-w-0 to addon manager content area by @lyestarzalt([4f97176](https://github.com/lyestarzalt/x-dispatch/commit/4f9717668713f713001d7129ed55217c52964e89))
- **map:** Replace style.load race condition with getStyle guard by @lyestarzalt([0627392](https://github.com/lyestarzalt/x-dispatch/commit/06273920c3436f2f9df3937135d05ac45132153a))

### Refactor

- **map:** Use transformStyle to preserve layers across basemap switches by @lyestarzalt([af2f6c3](https://github.com/lyestarzalt/x-dispatch/commit/af2f6c36ee999ae06a124ef35e36e0d66d8d9dff))

### Documentation

- Update CHANGELOG.md for v1.5.2 by @github-actions[bot]([26828ca](https://github.com/lyestarzalt/x-dispatch/commit/26828ca2d5afce2c4af73e40ffa4869993467127))
- Rewrite README with complete feature inventory by @lyestarzalt([91e0a27](https://github.com/lyestarzalt/x-dispatch/commit/91e0a27d600c2175b64150918be4bc431504f772))

### Release

- 1.5.3 by @github-actions[bot]([77973ee](https://github.com/lyestarzalt/x-dispatch/commit/77973ee948c44035e65a4836c382252ca30b24fe))


## v1.5.2 - 2026-03-16

### Features

- **map:** Add setting to toggle idle orbit camera, default off by @lyestarzalt([6275e00](https://github.com/lyestarzalt/x-dispatch/commit/6275e006ad50bfcc66dd9a0de775106814240e52))
- **settings:** Add multi X-Plane installation support by @lyestarzalt([2abf427](https://github.com/lyestarzalt/x-dispatch/commit/2abf4278622ba1d1b16da1413dd90f897ddd1ee1))

### Bug Fixes

- **settings:** Wrap installation name in brackets in window title by @lyestarzalt([a1eaf09](https://github.com/lyestarzalt/x-dispatch/commit/a1eaf09b0e9459873986fa8e27668aeeb7b24323))
- **map:** Prevent terrain disappearing after zoom out, add dev debug overlay by @lyestarzalt([8928eb7](https://github.com/lyestarzalt/x-dispatch/commit/8928eb79006de99406c453fc18665aaec18c5372))
- **queries:** Always rescan addon and aircraft lists on dialog open by @lyestarzalt([8487f1c](https://github.com/lyestarzalt/x-dispatch/commit/8487f1cae91ff673b753d442ba9a93aa3efe032e))

### Documentation

- Update CHANGELOG.md for v1.5.1 by @github-actions[bot]([cf0419f](https://github.com/lyestarzalt/x-dispatch/commit/cf0419ffd29e39795de1d93a5c723398815a4943))

### Release

- 1.5.2 by @github-actions[bot]([d7595cc](https://github.com/lyestarzalt/x-dispatch/commit/d7595ccb4330828c083221ac6b281ef4ad8b233d))


## v1.5.1 - 2026-03-15

### Features

- **start-position:** Toggle deselect for gates, runway ends & helipads by @lyestarzalt([8136be8](https://github.com/lyestarzalt/x-dispatch/commit/8136be850c6a9a1ba0b2803cc95850cb8c520c20))
- **map:** Add disk tile cache for MapLibre by @lyestarzalt([d8b821d](https://github.com/lyestarzalt/x-dispatch/commit/d8b821d71bdc888720fd5e91004d5987f2dba2cd))
- **map:** Add hillshade and contour lines to terrain visualization by @lyestarzalt([3bf967f](https://github.com/lyestarzalt/x-dispatch/commit/3bf967fb3833a38e909415fae661d8594bbb36e4))
- **map:** Add idle orbit camera around selected airport by @lyestarzalt([e0d5e4c](https://github.com/lyestarzalt/x-dispatch/commit/e0d5e4cd8346bb798ec0d83e3e40b8ea96566327))
- **map:** Add terrain shading toggle to toolbar overlays by @lyestarzalt([d9149ee](https://github.com/lyestarzalt/x-dispatch/commit/d9149ee02631d8705f6a5630875587e506ac537e))
- **settings:** Add close-on-launch option, remove networks tab by @lyestarzalt([e4579d6](https://github.com/lyestarzalt/x-dispatch/commit/e4579d64f130f70c77a7dde3360873bf3ef1ffdf))
- **window:** Display app version in title bar by @lyestarzalt([bddfc49](https://github.com/lyestarzalt/x-dispatch/commit/bddfc49cd686c9ff1361bd9ba46cb031529d21f8))
- **loading:** Add two-phase loading screen with granular airport progress by @lyestarzalt([7f8650a](https://github.com/lyestarzalt/x-dispatch/commit/7f8650aef3fea2b9882e0223c95a8d1c0fc77687))
- **data:** Detect symlinked scenery packs in Custom Scenery folder by @lyestarzalt([05dd57d](https://github.com/lyestarzalt/x-dispatch/commit/05dd57dcfbbc519bce3c13e3d4644fc2507e0a50))
- **branding:** Redesign app icon and inline SVG logo component by @lyestarzalt([f436dc2](https://github.com/lyestarzalt/x-dispatch/commit/f436dc274ac815c0a8a0d61b03ffb0f69b3c07d6))

### Bug Fixes

- **ci:** Include arch in Windows and Linux binary names by @lyestarzalt([6c79f77](https://github.com/lyestarzalt/x-dispatch/commit/6c79f77b91c83fe6108c8b2f4b186f996ae1f4ad))
- **data:** Validate airport cache on startup before marking as loaded by @lyestarzalt([6ae5679](https://github.com/lyestarzalt/x-dispatch/commit/6ae5679f24136a5e98e60ffd9f324116178f1bda))
- **launch:** Place fuel in correct X-Plane tank slot for third-party aircraft by @lyestarzalt([c228bfd](https://github.com/lyestarzalt/x-dispatch/commit/c228bfdc260ed8e8c3e1c58a089204c8c859439d))
- **addons:** Harden scenery detection and improve addon manager UI by @lyestarzalt([6dabc3a](https://github.com/lyestarzalt/x-dispatch/commit/6dabc3abdc2734a40e22e0ee003eb551c9592c9c))
- **launch:** Exclude AI traffic .acf files from aircraft scanner by @lyestarzalt([a21a6a2](https://github.com/lyestarzalt/x-dispatch/commit/a21a6a2cea0391bd182cf92ef4b4b54ee83c2179))
- **addons:** Allow backslash in aircraft folder paths for livery scanning by @lyestarzalt([e984d7d](https://github.com/lyestarzalt/x-dispatch/commit/e984d7d8ba3e913f83a1230005469d69fd90976f))
- **map:** Prevent terrain crashes on globe projection and silence DEM errors by @lyestarzalt([39b7470](https://github.com/lyestarzalt/x-dispatch/commit/39b74705b00d17697ee3096e6a0c3d08ee5ead16))

### Documentation

- Update CHANGELOG.md for v1.5.0 by @github-actions[bot]([9e6d22b](https://github.com/lyestarzalt/x-dispatch/commit/9e6d22b02548f229e7b261d2d50f0d8a99a4643d))
- Update Discord invite link by @lyestarzalt([dbdffbd](https://github.com/lyestarzalt/x-dispatch/commit/dbdffbd1e9fa30e2382e29da803c2eae82526188))

### Miscellaneous

- **db:** Add dbCredentials to drizzle config for Drizzle Studio by @lyestarzalt([82c1814](https://github.com/lyestarzalt/x-dispatch/commit/82c18140a32e7f37894665c9a7944ba21c584e13))

### Release

- 1.5.1 by @github-actions[bot]([903afa5](https://github.com/lyestarzalt/x-dispatch/commit/903afa5b2fa39f3837c1c19e579dadd3c59951e5))

### Wip

- **ils:** Scaffold 3D glide slope visualization (disabled) by @lyestarzalt([2153dff](https://github.com/lyestarzalt/x-dispatch/commit/2153dffc80ff424fd4136425d092089da5fa7180))


## v1.5.0 - 2026-03-12

### Features

- **weather:** Redesign WeatherDialog with interactive altitude diagram by @lyestarzalt([746b0f3](https://github.com/lyestarzalt/x-dispatch/commit/746b0f3772203dc04109563334428a2e16bb9daa))
- **weather:** Add environment controls, i18n, and fix dialog sizing by @lyestarzalt([b1be774](https://github.com/lyestarzalt/x-dispatch/commit/b1be774a833e3705bed99c11573e8e078b54db7f))
- **map:** Add day/night terminator overlay by @lyestarzalt([92c68e7](https://github.com/lyestarzalt/x-dispatch/commit/92c68e7b0948fa096481b03b0978d55b80e5f5eb))
- **map:** Add range rings layer for aircraft category reach visualization by @lyestarzalt([3281880](https://github.com/lyestarzalt/x-dispatch/commit/32818802ba4a970a9f7c743b14dcb9f37950e468))
- **map:** Add pin-drop custom start location by @lyestarzalt([b40174a](https://github.com/lyestarzalt/x-dispatch/commit/b40174a77304f1ca02434dc213b1ca249ece2eda))
- **launcher:** Persist aircraft list filters across sessions by @lyestarzalt([349ba19](https://github.com/lyestarzalt/x-dispatch/commit/349ba19a42628f0ee3aeb3c887a7e044a4092f4e))
- **map:** Render aircraft silhouettes for VATSIM/IVAO traffic by @lyestarzalt([8787439](https://github.com/lyestarzalt/x-dispatch/commit/8787439289ba336c77edfd427736842e7f97cbc7))
- **map:** Redesign player aircraft icon with canvas-based rendering by @lyestarzalt([1269e92](https://github.com/lyestarzalt/x-dispatch/commit/1269e92d914e49015ea8be4246ff5a6ae5225c60))
- **xplane:** Detect aircraft category from X-Plane metadata datarefs by @lyestarzalt([090546c](https://github.com/lyestarzalt/x-dispatch/commit/090546c83d49276dd064e60515d5cbff77e76605))
- **flight-strip:** Redesign with grouped layout, color-coded values, drag-to-reposition & new datarefs by @lyestarzalt([72b7156](https://github.com/lyestarzalt/x-dispatch/commit/72b7156016723f4f64093d1f7575e1f89a12f514))
- **logbook:** Save last 10 launches with browse & restore by @lyestarzalt([37dee95](https://github.com/lyestarzalt/x-dispatch/commit/37dee95297cdf841515058e22cbef6b69aebe9de))

### Bug Fixes

- **ui:** Add forwardRef to Badge component by @lyestarzalt([063c025](https://github.com/lyestarzalt/x-dispatch/commit/063c025ba2c9331102ec9671af64e5f2bf3c9dba))
- **ui:** Correct ref types and add missing forwardRef in shadcn components by @lyestarzalt([2875eeb](https://github.com/lyestarzalt/x-dispatch/commit/2875eebb265e995b506e452de330beb47d84553e))
- **launcher:** Derive fuel tank ratios from _cgpt capacity for third-party helicopters by @lyestarzalt([754b3b0](https://github.com/lyestarzalt/x-dispatch/commit/754b3b0a99762ec35bf3c686cc6b54b6dec3a981))
- **launcher:** Skip --version on Windows Steam to avoid launch dialog by @lyestarzalt([05fba79](https://github.com/lyestarzalt/x-dispatch/commit/05fba7943a994adad41750bd9b754def4eda8191))
- **launcher:** Correct fuel tank count for third-party aircraft by @lyestarzalt([640d1ad](https://github.com/lyestarzalt/x-dispatch/commit/640d1adace251928138dd8d01d7522b1d243463b))
- **launcher:** Improve fuel parsing and add payload fallback for third-party aircraft by @lyestarzalt([710cc82](https://github.com/lyestarzalt/x-dispatch/commit/710cc82cd8070f3682d9812a5bbfa245dbca3940))
- **launcher:** Adjust sun arc horizon line based on day length by @lyestarzalt([66c7560](https://github.com/lyestarzalt/x-dispatch/commit/66c756067fc1c57578db75b21d947437c700a7ef))
- **launcher:** Persist aircraft path instead of full object to prevent stale livery/config by @lyestarzalt([ee2a562](https://github.com/lyestarzalt/x-dispatch/commit/ee2a562b8e6ab1071d986bc0a944fe7f98d8c6e4))
- **map:** Clear selected procedure when flight plan is removed by @lyestarzalt([45caaf6](https://github.com/lyestarzalt/x-dispatch/commit/45caaf6e594e36e6014f2b934d779944b7f72341))
- **map:** Replace deferred layer removal with synchronous getStyle guard by @lyestarzalt([9166bb2](https://github.com/lyestarzalt/x-dispatch/commit/9166bb283e080201ccc5a6e29d43708eabffa4b3))
- **addons:** Invalidate launcher aircraft cache after addon mutations by @lyestarzalt([e0666fd](https://github.com/lyestarzalt/x-dispatch/commit/e0666fdab09591ece1f61177c6c173d0f5d8ac95))

### Refactor

- **ui:** Clean up LoadingScreen design system usage and dead code by @lyestarzalt([ed1873f](https://github.com/lyestarzalt/x-dispatch/commit/ed1873fec11da2122a5f0075cd6f85b05dee5b7b))
- **ui:** Add categorical color tokens to design system by @lyestarzalt([7dc7628](https://github.com/lyestarzalt/x-dispatch/commit/7dc7628ea96b5e9c13c633eafc81b3bb57999059))
- **ui:** Convert remaining hardcoded colors to design system tokens by @lyestarzalt([6c908b8](https://github.com/lyestarzalt/x-dispatch/commit/6c908b828ca9f40888527ec22d33beafc0954609))
- **ui:** Use correct shadcn/ui components for tabs, toggles, and buttons by @lyestarzalt([4e31591](https://github.com/lyestarzalt/x-dispatch/commit/4e31591116a4a27c4aff1056cd82d4b8dfba6162))
- **ui:** Centralize Badge variants, Button tooltips, and Spinner component by @lyestarzalt([019a4fd](https://github.com/lyestarzalt/x-dispatch/commit/019a4fdc363bb61da6c800f0a1c0ba970c6a7f61))
- **ui:** Add Input icon slots, improve FlightConfig layout and token usage by @lyestarzalt([315d102](https://github.com/lyestarzalt/x-dispatch/commit/315d1024b41a3770de46960cd2e918081e95d08d))
- **websocket:** Replace ad-hoc reconnect with state machine, backoff & keepalive by @lyestarzalt([38faca3](https://github.com/lyestarzalt/x-dispatch/commit/38faca3839c3763bc7288d8b754ab52d444dda39))

### Documentation

- Update CHANGELOG.md for v1.4.1 by @github-actions[bot]([b94c99a](https://github.com/lyestarzalt/x-dispatch/commit/b94c99a09897740e88a158038561371198da1b8d))

### Miscellaneous

- **ci:** Add separate mac arm64/x64 builds and rename artifacts by @lyestarzalt([32f7722](https://github.com/lyestarzalt/x-dispatch/commit/32f772237bd0e5f8835618584a87e16f4a63dc4b))

### Release

- 1.5.0 by @github-actions[bot]([c881e52](https://github.com/lyestarzalt/x-dispatch/commit/c881e52153299d74643cbb2ae2e682d3d01313f6))


## v1.4.1 - 2026-03-06

### Features

- **map:** Add country and surface type airport filters by @lyestarzalt([044d1d3](https://github.com/lyestarzalt/x-dispatch/commit/044d1d3d0c20f8bd2b3865ffff9a57fe5424b0f2))
- **data:** Detect and store exact X-Plane version by @lyestarzalt([c7aa4bc](https://github.com/lyestarzalt/x-dispatch/commit/c7aa4bc4ea8a9a62c5eb7ed94c69a9a00cda86f4))
- **gateway:** Detect and display newer Gateway scenery releases by @lyestarzalt([94c688d](https://github.com/lyestarzalt/x-dispatch/commit/94c688de994fd5c7d656c71e1635b883bc844ad4))

### Bug Fixes

- **simbrief:** Prevent empty object rendering in VerticalProfile tooltip by @lyestarzalt([06bcda7](https://github.com/lyestarzalt/x-dispatch/commit/06bcda779b3026c7087fb05a8f65c96cb985e85f))
- **launcher:** Handle CRLF line endings and missing tank names in ACF parser by @lyestarzalt([51d8d16](https://github.com/lyestarzalt/x-dispatch/commit/51d8d16f65c116336afe4010f512df7e1d4d6742))
- **addon-manager:** Always detect .acf as aircraft regardless of nesting by @lyestarzalt([0f78da9](https://github.com/lyestarzalt/x-dispatch/commit/0f78da9ccd3f84886598ac7770ec78be445d3354))
- **addon-manager:** Resolve 7zip binary path and add alpha badge by @lyestarzalt([42f20e6](https://github.com/lyestarzalt/x-dispatch/commit/42f20e6a34552a74be00826cdb3b4a917ae0785f))
- **launcher:** Switch ramp spawn from lle_ground_start to ramp_start by @lyestarzalt([9a9f22e](https://github.com/lyestarzalt/x-dispatch/commit/9a9f22ed11b924551ae0d1dfa2fe8fc1376c2ac0))
- **map:** Update existing sources when switching airports by @lyestarzalt([e64ae55](https://github.com/lyestarzalt/x-dispatch/commit/e64ae552d40e7d51e2204fa360d40cb6a240c04d))
- **db:** Handle Windows file lock when deleting stale database by @lyestarzalt([d7b97f6](https://github.com/lyestarzalt/x-dispatch/commit/d7b97f648f5667ac472da934195506df54e5ca56))
- **sentry:** Skip renderer error reporting in development by @lyestarzalt([39ee519](https://github.com/lyestarzalt/x-dispatch/commit/39ee5190f53a33d814d13d4f82c9158b262fcd75))

### Documentation

- Update CHANGELOG.md for v1.4.0 by @github-actions[bot]([eefdff9](https://github.com/lyestarzalt/x-dispatch/commit/eefdff95be6e11f78416d8ddc8e748364c8ef2a1))

### Miscellaneous

- **about:** Add Gilles to credits as special thanks for testing by @lyestarzalt([13a317f](https://github.com/lyestarzalt/x-dispatch/commit/13a317f7c2a52ad05fe26f7ed5b1d947ca28f3bc))
- Add emojis to README and gitignore design system files by @lyestarzalt([5200700](https://github.com/lyestarzalt/x-dispatch/commit/5200700ed3e1a3eeedf39eaa2ac2edcd2e1a443e))

### Release

- 1.4.1 by @github-actions[bot]([f3a1982](https://github.com/lyestarzalt/x-dispatch/commit/f3a198282b7188fa822e38a282dd90c98ed4cd80))


## v1.4.0 - 2026-03-03

### Features

- **networks:** Add IVAO online network support with mutual exclusivity by @lyestarzalt([19d3fb6](https://github.com/lyestarzalt/x-dispatch/commit/19d3fb6876825dc7dcf351fd5d13c79bbb4f021f))
- **launcher:** Add Weight, Balance & Fuel dialog with per-tank fuel and payload stations by @lyestarzalt([c76112e](https://github.com/lyestarzalt/x-dispatch/commit/c76112ebf8c7db9657605f7351cfd3774e9d1cd8))
- **launcher:** Add weather customization with presets and custom mode by @lyestarzalt([4ecd3cd](https://github.com/lyestarzalt/x-dispatch/commit/4ecd3cdfd7fbb5431f62578328e33e688fe95c71))
- **launcher:** Replace SunArc with visual celestial arc component by @lyestarzalt([2180918](https://github.com/lyestarzalt/x-dispatch/commit/21809180e045ef2fab2771da864c882c7b1ac08b))

### Bug Fixes

- **ivao:** Add null guards for external API data by @lyestarzalt([3e5c076](https://github.com/lyestarzalt/x-dispatch/commit/3e5c076e5a9edb86005aab9189de204d298f4ced))

### Refactor

- **launcher:** Clean up FlightConfig sidebar layout by @lyestarzalt([ae2f66f](https://github.com/lyestarzalt/x-dispatch/commit/ae2f66f4307911eb7e095bd100d42b53a306890c))

### Documentation

- Update CHANGELOG.md for v1.3.2 by @github-actions[bot]([8c8fceb](https://github.com/lyestarzalt/x-dispatch/commit/8c8fcebafeda27db84361f09b0230119a0476c4f))

### Release

- 1.4.0 by @github-actions[bot]([8acbdfc](https://github.com/lyestarzalt/x-dispatch/commit/8acbdfcc7b2f2bfe820ef75f0277db4351e102b5))


## v1.3.2 - 2026-03-03

### Bug Fixes

- **map:** Improve MapLibre error logging and SVG icon loading by @lyestarzalt([e45f39e](https://github.com/lyestarzalt/x-dispatch/commit/e45f39e0d566eeaec9d8284e215bf313c22d6cd7))
- **addon-manager:** User-friendly error for EPERM in protected X-Plane folders by @lyestarzalt([36f3d94](https://github.com/lyestarzalt/x-dispatch/commit/36f3d94a5363792892dc1a69a9c49ad7fbd3d8dd))
- **simbrief:** Guard against non-string NOTAM and SIGMET fields by @lyestarzalt([f799cc4](https://github.com/lyestarzalt/x-dispatch/commit/f799cc4ca1410e01e1d0289acf2ad6cd2a4d90df))
- **map:** Guard against NaN coordinates in fitMapToFlightPlan by @lyestarzalt([be26180](https://github.com/lyestarzalt/x-dispatch/commit/be261805470f3795dc18da7f7621f32a84e9e88b))
- **launcher:** Preserve unrecognized lines in Freeflight.prf by @lyestarzalt([cf5cc34](https://github.com/lyestarzalt/x-dispatch/commit/cf5cc3438ff2d3e183dfb16f570256c92d61ac3b))
- **addon-manager:** Preserve scenery_packs.ini order and disable by default by @lyestarzalt([abe9377](https://github.com/lyestarzalt/x-dispatch/commit/abe93770b540421da081ecf192bf0491187bd8e6))
- **compass:** Normalize bearing to 0-360 instead of -180 to 180 by @lyestarzalt([beea761](https://github.com/lyestarzalt/x-dispatch/commit/beea76156d368a312064d5ff8d7be9f13f0aebc3))

### Refactor

- **toolbar:** Consolidate 12 items into 7 for narrow-screen support by @lyestarzalt([56583b2](https://github.com/lyestarzalt/x-dispatch/commit/56583b2edc2c2bcfe34478e22f0e880a7b369b16))
- **launcher:** Use FlightInit JSON for cold start instead of Freeflight.prf by @lyestarzalt([03b81ff](https://github.com/lyestarzalt/x-dispatch/commit/03b81ff5eda41c74a42762f7ade7079ceaa0b112))
- **ui:** Move addon manager from settings to toolbar by @lyestarzalt([2dafc48](https://github.com/lyestarzalt/x-dispatch/commit/2dafc484c3dcaf7f201a09909cb03f19bf40472a))
- **addon-manager:** Always show in toolbar and indicate order is preserved by @lyestarzalt([9e4c9e5](https://github.com/lyestarzalt/x-dispatch/commit/9e4c9e59c0f294db0a3ad2f898f04cd703ad2cc8))

### Documentation

- Update CHANGELOG.md for v1.3.1 by @github-actions[bot]([219c29c](https://github.com/lyestarzalt/x-dispatch/commit/219c29ca7e03e00febd7cdf4a6bf8418fba504d4))

### Miscellaneous

- **deps:** Upgrade maplibre-gl to ^5.19.0 by @lyestarzalt([31dec6d](https://github.com/lyestarzalt/x-dispatch/commit/31dec6d332fa2a382763ec442274d02ee49b1288))
- **launcher:** Add TODO for --no_save_prefs user settings issue by @lyestarzalt([061580a](https://github.com/lyestarzalt/x-dispatch/commit/061580adf476c4edb432c793a194ff530090548b))
- **launcher:** Add TODO for pgrep false positive on macOS by @lyestarzalt([f9cc84e](https://github.com/lyestarzalt/x-dispatch/commit/f9cc84e71eb5c1bb1013fc1f552b729769192914))

### Release

- 1.3.2 by @github-actions[bot]([87dba35](https://github.com/lyestarzalt/x-dispatch/commit/87dba35028bc70c909766c1e2d606107aba3bfa6))


## v1.3.1 - 2026-03-01

### Bug Fixes

- **map:** Defer layer removal when MapLibre is mid-render by @lyestarzalt([3b7ad64](https://github.com/lyestarzalt/x-dispatch/commit/3b7ad64d03c674f1b4db0b688b50541a02e98f64))
- **simbrief:** Surface real API error message instead of generic HTTP 400 by @lyestarzalt([91e52be](https://github.com/lyestarzalt/x-dispatch/commit/91e52be3c41ad486e17814c3eddc604a72e55d9d))
- **map:** Fix taxiway name layer interpolation and visibility by @lyestarzalt([8bf1e79](https://github.com/lyestarzalt/x-dispatch/commit/8bf1e79efd4d73a3b0ca78a5182ece82a019f2df))
- **simbrief:** Sanitize API response to handle empty objects by @lyestarzalt([5d2bd71](https://github.com/lyestarzalt/x-dispatch/commit/5d2bd71393d9580e0436acd425436e160ceba792))
- Terrain DEM maxzoom and SimBrief array coercion crashes by @lyestarzalt([b0aed02](https://github.com/lyestarzalt/x-dispatch/commit/b0aed02e71ae4cd8e7eb0f6844aadc430d12d49e))
- **sentry:** Fix source map uploads and VerticalProfile crash by @lyestarzalt([0805250](https://github.com/lyestarzalt/x-dispatch/commit/0805250c758a22be000cd8697b4c55368f81a782))
- **simbrief:** Tell user to generate a flight plan on simbrief.com first by @lyestarzalt([b24ddb1](https://github.com/lyestarzalt/x-dispatch/commit/b24ddb15087599e9f4c041cb09873836ce16d7b3))

### Documentation

- Update CHANGELOG.md for v1.3.0 by @github-actions[bot]([af9842a](https://github.com/lyestarzalt/x-dispatch/commit/af9842a7fd0fdb63a18f54e6b55a8266499d83e5))

### Release

- 1.3.1 by @github-actions[bot]([bc6d84c](https://github.com/lyestarzalt/x-dispatch/commit/bc6d84c8366ef696489e0939fc263c3f1756f2ae))


## v1.3.0 - 2026-03-01

### Features

- **settings:** Add user-configurable font size (small/medium/large) by @lyestarzalt([69042ad](https://github.com/lyestarzalt/x-dispatch/commit/69042ad0db574bec43a128acf5055dc6fb270dc0))
- **launcher:** Persist flight config across sessions by @lyestarzalt([77566f6](https://github.com/lyestarzalt/x-dispatch/commit/77566f6135806437ec6f04f5584988965b5d3d69))
- **map:** Add airport dot filters (type, custom scenery) by @lyestarzalt([a5cd8cd](https://github.com/lyestarzalt/x-dispatch/commit/a5cd8cd5633faf90537874147d40d9757a77e00f))
- **map:** Add taxiway name labels from taxi route network by @lyestarzalt([b975ecb](https://github.com/lyestarzalt/x-dispatch/commit/b975ecb73f3d3dc5979a8590852bf690f2084eed))
- **map:** Add live weather radar overlay using RainViewer API by @lyestarzalt([52b5068](https://github.com/lyestarzalt/x-dispatch/commit/52b5068bdc9962bf31f1c2c0745efd0a846f12de))

### Bug Fixes

- **ui:** Increase base text size from text-xs to text-sm across all components by @lyestarzalt([a1d9492](https://github.com/lyestarzalt/x-dispatch/commit/a1d9492b0cb460190a26affe1cc5acdd34261924))
- **db:** Replace broken migration system with schema fingerprinting by @lyestarzalt([3322bc3](https://github.com/lyestarzalt/x-dispatch/commit/3322bc331bc3e4cfd23005609b295ae5b259eaf0))
- **main:** Retry DB init on failure to prevent zombie app state by @lyestarzalt([9bfe1c0](https://github.com/lyestarzalt/x-dispatch/commit/9bfe1c0ac46fa94fbd9289f38ca3589b190e7448))
- **db:** Harden startup against all DB failure paths by @lyestarzalt([2029349](https://github.com/lyestarzalt/x-dispatch/commit/20293494eb807eb38dade26cd4447eaec3ab2b6d))
- **main:** Move window security handlers into createWindow by @lyestarzalt([889f8a4](https://github.com/lyestarzalt/x-dispatch/commit/889f8a4f47a516dced3fe8417d7832145523e880))

### Refactor

- **layers:** Centralize zoom levels with named ZOOM_LEVEL constants by @lyestarzalt([562ae3c](https://github.com/lyestarzalt/x-dispatch/commit/562ae3c1ae40d5a10a0d645bd36c8d1ead278d53))

### Documentation

- Update CHANGELOG.md for v1.2.1 by @github-actions[bot]([6ac181c](https://github.com/lyestarzalt/x-dispatch/commit/6ac181cd11b3c747fac50b0fa0f4c52675f76af1))
- Add Ko-fi donation badge and link by @lyestarzalt([283f2d6](https://github.com/lyestarzalt/x-dispatch/commit/283f2d63aad0233d202a6c05c6b7e3aab98f2fba))
- Move macOS install notice below intro section by @lyestarzalt([e3f69e4](https://github.com/lyestarzalt/x-dispatch/commit/e3f69e4a0eaefd7c55c898e8c881c138de3a6440))
- Update X-Plane requirement to 12.4+ by @lyestarzalt([b333058](https://github.com/lyestarzalt/x-dispatch/commit/b333058ae3d29d84604c7b3fabbdeef091905c06))

### Release

- 1.3.0 by @github-actions[bot]([c699ba6](https://github.com/lyestarzalt/x-dispatch/commit/c699ba601cfdbfebdca1c1b04725c3968fa74b64))


## v1.2.1 - 2026-02-28

### Features

- **gates:** Square helipad backgrounds with heading indicator by @lyestarzalt([9990d19](https://github.com/lyestarzalt/x-dispatch/commit/9990d19317e20b1fc848aeeb22f7b927eb853478))

### Bug Fixes

- **parser:** Gates pointing wrong direction due to negative headings in apt.dat by @lyestarzalt([8d7c896](https://github.com/lyestarzalt/x-dispatch/commit/8d7c896e8fe90d44da24b4aabfd7b8e048eecede))

### Documentation

- Add CHANGELOG.md and auto-update on release by @lyestarzalt([7722a2f](https://github.com/lyestarzalt/x-dispatch/commit/7722a2fe62031d3d8b16a6736a179d70e20c28f4))
- Add star prompt to README by @lyestarzalt([c036324](https://github.com/lyestarzalt/x-dispatch/commit/c036324ddc7967e743a2cc5b7be8282758c07a6b))

### Miscellaneous

- Update package.json keywords and description by @lyestarzalt([8ee7887](https://github.com/lyestarzalt/x-dispatch/commit/8ee78879518f127a597ef80fc3226a851f6f2800))

### CI/CD

- Add Discord notification on release by @lyestarzalt([98618f3](https://github.com/lyestarzalt/x-dispatch/commit/98618f3239f45e9d0859e84231f2758007b9dc8f))
- **release:** Pull latest before changelog commit in finalize step by @lyestarzalt([527b867](https://github.com/lyestarzalt/x-dispatch/commit/527b867997fbddd45440f49fecdde3a11d86d183))

### Release

- 1.2.1 by @github-actions[bot]([78657b3](https://github.com/lyestarzalt/x-dispatch/commit/78657b3c592e2190fc1934d25e5c6dfcc7193211))


## v1.2.0 - 2026-02-28

### Features

- **map:** Add phase-colored route, T/C T/D markers, and alternate airport to flight plan layer by @lyestarzalt([0e77f64](https://github.com/lyestarzalt/x-dispatch/commit/0e77f64a8f4ab2e67219d9d0e5f428d9fcb18820))
- **simbrief:** Expand OFP dialog with vertical profile, navlog, performance, and briefing tabs by @lyestarzalt([b0e3189](https://github.com/lyestarzalt/x-dispatch/commit/b0e31896afd45ec1dd54f1f24809404e117ad21a))

### Bug Fixes

- **sentry:** Upload source maps for all processes and enable tracing and session replay by @lyestarzalt([687ca22](https://github.com/lyestarzalt/x-dispatch/commit/687ca226a53d0d9ec20804ecc1dc7e0780ab2ffc))

### Documentation

- Update flight setup screenshot by @lyestarzalt([5d9ee6a](https://github.com/lyestarzalt/x-dispatch/commit/5d9ee6a37ae4000fa961cbfbb11319d5156d2cea))

### Release

- 1.2.0 by @github-actions[bot]([3299c83](https://github.com/lyestarzalt/x-dispatch/commit/3299c837d00c0c8989fb54d71a356d7db4d45f44))


## v1.1.0 - 2026-02-27

### Features

- **addon-manager:** Add core types and Result utilities by @lyestarzalt([86c5048](https://github.com/lyestarzalt/x-dispatch/commit/86c5048cc1553c58a625fdb6688afb72bf58cd87))
- **addon-manager:** Add scenery_packs.ini parser by @lyestarzalt([bdb28ad](https://github.com/lyestarzalt/x-dispatch/commit/bdb28ad65ad8c88b61c487a26aaa1f871fab1fd8))
- **addon-manager:** Add DSF binary header parser by @lyestarzalt([9dc8f74](https://github.com/lyestarzalt/x-dispatch/commit/9dc8f74cab3e706f638a018c3468c5052538df93))
- **addon-manager:** Add folder scanner for classification by @lyestarzalt([581ea0d](https://github.com/lyestarzalt/x-dispatch/commit/581ea0d203cb3f61eef0479cc2bd8c8004a2e68e))
- **addon-manager:** Add scenery classifier with priority tiers by @lyestarzalt([7da73d7](https://github.com/lyestarzalt/x-dispatch/commit/7da73d754a77c1f76305c8e132dadb39cf35e4f6))
- **addon-manager:** Add SceneryManager class by @lyestarzalt([0e025b1](https://github.com/lyestarzalt/x-dispatch/commit/0e025b126ac1a61dcd9588b66a4db62dd9a6d67b))
- **addon-manager:** Extract IPC handlers to separate module by @lyestarzalt([0da606f](https://github.com/lyestarzalt/x-dispatch/commit/0da606fea8192715f1fbcd681f7ef9414b25506e))
- **addon-manager:** Add React Query hooks by @lyestarzalt([98f7574](https://github.com/lyestarzalt/x-dispatch/commit/98f75743d2d83dc362f0c3789d6d01473e6d3cfc))
- **addon-manager:** Add Addon Manager dialog UI by @lyestarzalt([d21dc17](https://github.com/lyestarzalt/x-dispatch/commit/d21dc179417bf63e4c8f234ccd6407d4bde7958d))
- **addon-manager:** Integrate with main process and UI by @lyestarzalt([1b8aedd](https://github.com/lyestarzalt/x-dispatch/commit/1b8aedd9e2cb71ba48f21c373ce6c0ee2c71af9e))
- **addon-browser:** Add browser types by @lyestarzalt([3b87a10](https://github.com/lyestarzalt/x-dispatch/commit/3b87a102e07f14696e664cd907c2a1faa2c7f592))
- **addon-browser:** Add version detector module by @lyestarzalt([0fdee99](https://github.com/lyestarzalt/x-dispatch/commit/0fdee99a4f6765609e095ee983995c9124284128))
- **addon-browser:** Add aircraft scanner by @lyestarzalt([53c565b](https://github.com/lyestarzalt/x-dispatch/commit/53c565b51824f528d7d03632e7ea2cc138ebae3f))
- **addon-browser:** Implement installed addon browser with security hardening by @lyestarzalt([c39e22d](https://github.com/lyestarzalt/x-dispatch/commit/c39e22d44cf474216aba6267a29d355c3feba5f2))
- **installer:** Add installer types by @lyestarzalt([03a41a8](https://github.com/lyestarzalt/x-dispatch/commit/03a41a8d07d3d423f4511aef925ffcbfc5901925))
- **installer:** Add archive scanner for ZIP/7z/RAR by @lyestarzalt([1ae6330](https://github.com/lyestarzalt/x-dispatch/commit/1ae6330badcc1ef2f6082026343edba59a945e14))
- **installer:** Add type detector for addon classification by @lyestarzalt([26e1cda](https://github.com/lyestarzalt/x-dispatch/commit/26e1cda856bf71a186000aef2570097af2bc518e))
- **installer:** Add InstallerManager with analyze method by @lyestarzalt([0c411d0](https://github.com/lyestarzalt/x-dispatch/commit/0c411d06aea933b6b02778da6390faef17b44ccb))
- **installer:** Add installer:analyze IPC handler by @lyestarzalt([bab791c](https://github.com/lyestarzalt/x-dispatch/commit/bab791cec4bbaeb1bec1d92f625a0cf82f10a324))
- **installer:** Add installer preload API by @lyestarzalt([bb9c0e3](https://github.com/lyestarzalt/x-dispatch/commit/bb9c0e374bb25a8a9e2fb8b2cd360a9ef33ecbad))
- **installer:** Add useInstallerAnalyze hook by @lyestarzalt([9cc7347](https://github.com/lyestarzalt/x-dispatch/commit/9cc734754d1f9b9ed47271d8d5881aaa94b31dcb))
- **installer:** Add InstallerTab UI with DropZone by @lyestarzalt([d1502d6](https://github.com/lyestarzalt/x-dispatch/commit/d1502d68aeda7613f9eb7fcd28a4a1a86ab619fa))
- **installer:** Integrate InstallerTab into AddonManager by @lyestarzalt([c72a738](https://github.com/lyestarzalt/x-dispatch/commit/c72a738c968b353f100517fe3bb5d80be50f9aaa))
- **installer:** Add click-to-browse file picker by @lyestarzalt([d21de4a](https://github.com/lyestarzalt/x-dispatch/commit/d21de4ad6add3807b28f107a8870a188b0b31157))
- **installer:** Implement Phase 2 addon installation by @lyestarzalt([5e2a650](https://github.com/lyestarzalt/x-dispatch/commit/5e2a6503cb09cbc38d5f8545d3d3dead9aea7734))
- **addon-manager:** Add logging for key operations by @lyestarzalt([53a293b](https://github.com/lyestarzalt/x-dispatch/commit/53a293bf6b1c6307909aa6cbddb350559d0d918f))
- **addon-manager:** Add i18n support by @lyestarzalt([90447d2](https://github.com/lyestarzalt/x-dispatch/commit/90447d25806b7e560f65ac4ca28abb423d5b919e))
- **addon-manager:** Complete i18n for all components by @lyestarzalt([614c74c](https://github.com/lyestarzalt/x-dispatch/commit/614c74c467dd4b5ae57c75fe785d79b4952966e9))
- **i18n:** Add addonManager translations for all languages by @lyestarzalt([a3d7ce9](https://github.com/lyestarzalt/x-dispatch/commit/a3d7ce9452877580c5d059bdcd9ed626f7a15573))
- **addon-manager:** Redesign UI/UX for all tabs by @lyestarzalt([9799939](https://github.com/lyestarzalt/x-dispatch/commit/9799939eaaa1f32d555a8e298901059ed63537ca))
- **toolbar:** Add Alpha badge to Addons button by @lyestarzalt([83aaf78](https://github.com/lyestarzalt/x-dispatch/commit/83aaf78b46b8267c46b14caafcbc2e5050bbb41a))
- **simbrief:** Add SimBrief flight plan import integration by @lyestarzalt([f4f2e57](https://github.com/lyestarzalt/x-dispatch/commit/f4f2e57b53d717218d0ec15f9071552824e9f285))

### Bug Fixes

- Resolve multiple Sentry bugs by @lyestarzalt([4201c1c](https://github.com/lyestarzalt/x-dispatch/commit/4201c1c25f5f42088e1623bebbdf36a8f81cb3f1))
- **map:** Defer layer removal during render to prevent MapLibre crash by @lyestarzalt([d2aaec7](https://github.com/lyestarzalt/x-dispatch/commit/d2aaec79872a4f04bfe6a80e329e2bcdcfa522b9))
- **map:** Throttle approach light animation to 30fps by @lyestarzalt([d8fb89c](https://github.com/lyestarzalt/x-dispatch/commit/d8fb89c912f87d19b7e4de60be7b63b3e56514c6))
- **tracker:** Clear stale flight data on reconnect and add reconnect button by @lyestarzalt([ba7d34d](https://github.com/lyestarzalt/x-dispatch/commit/ba7d34d554c9d9b171dc9d805f31b63848649b4e))
- **addon-manager:** Add backup cleanup and error handling by @lyestarzalt([90abb34](https://github.com/lyestarzalt/x-dispatch/commit/90abb346b33965cc059ef523876a78b673135f63))
- **apt-parser:** Handle seaplane and heliport headers by @lyestarzalt([31810dd](https://github.com/lyestarzalt/x-dispatch/commit/31810dd38da904258af0e8a2b7a4ecb0185261ae))
- **installer:** Address null safety issues by @lyestarzalt([8a1c2d7](https://github.com/lyestarzalt/x-dispatch/commit/8a1c2d71c42daf42eb726d0aa6e37763036ede5b))
- **installer:** Remove duplicate empty state text by @lyestarzalt([1d60835](https://github.com/lyestarzalt/x-dispatch/commit/1d6083525d7be97ab4c2c7b33877602ded457eca))
- Remove plane marker when X-Plane process stops by @lyestarzalt([728b1cf](https://github.com/lyestarzalt/x-dispatch/commit/728b1cf8e6ca4359a1ac4fdc6822fdefda715ff4))

### Refactor

- **db:** Replace manual SQL with Drizzle migrations by @lyestarzalt([09fa50b](https://github.com/lyestarzalt/x-dispatch/commit/09fa50b7b2c637ba8a44c776d6a92b3102bee409))

### Documentation

- Update README with SimBrief and Addon Manager features by @lyestarzalt([c9ae82d](https://github.com/lyestarzalt/x-dispatch/commit/c9ae82d3bdc8d61df87db0fae19b9dc6bc620672))
- Add starting position and tracking screenshots, update Discord link by @lyestarzalt([c0ecd6c](https://github.com/lyestarzalt/x-dispatch/commit/c0ecd6cc5898be54972c8594e1f25af921b24146))
- Update settings screenshot by @lyestarzalt([a255187](https://github.com/lyestarzalt/x-dispatch/commit/a2551879bbe10a539f0933956a9f5983e165a2b0))

### Miscellaneous

- Add TODO for TerrainControl crash issue by @lyestarzalt([caa2d30](https://github.com/lyestarzalt/x-dispatch/commit/caa2d30c00922b1fef7cdf38e64bf33f9f14501c))
- **ci:** Add commit links to changelog by @lyestarzalt([fc20c7e](https://github.com/lyestarzalt/x-dispatch/commit/fc20c7ee3ebc151400627b3d92a6ecd0ea75e130))
- Add memory optimization TODO by @lyestarzalt([9f96c29](https://github.com/lyestarzalt/x-dispatch/commit/9f96c2918e83626affa3618067b4df695d70c2a3))
- Add archive handling dependencies by @lyestarzalt([cd1ffd6](https://github.com/lyestarzalt/x-dispatch/commit/cd1ffd615ea2f1b2efdfd3e16e4feb98e5e97156))
- Remove debug console.log statements by @lyestarzalt([600fdd1](https://github.com/lyestarzalt/x-dispatch/commit/600fdd126e5509afb6e82d5300db7ad4a831040a))

### Release

- 1.1.0 by @github-actions[bot]([2dbbfa9](https://github.com/lyestarzalt/x-dispatch/commit/2dbbfa916913b2d75a6f1aee71f56d5d6817a8ff))


## v1.0.0 - 2026-02-24

### Features

- Add flight plan loading and nav layer consolidation by @lyestarzalt([c1da4ed](https://github.com/lyestarzalt/x-dispatch/commit/c1da4ede537caf88b4cf85cdfce0353fce75ff3d))
- Add follow mode for plane tracking by @lyestarzalt([d29e6d3](https://github.com/lyestarzalt/x-dispatch/commit/d29e6d37691f6f6f0f8afc07daafc97f2937afc4))
- Add Sentry error tracking integration by @lyestarzalt([a2d4e19](https://github.com/lyestarzalt/x-dispatch/commit/a2d4e198d3053064c94a77d22f7a339e850c97db))
- **flightplan:** Enrich waypoints with nav database info by @lyestarzalt([ae30143](https://github.com/lyestarzalt/x-dispatch/commit/ae30143a4fce04314fef68dd15de72f3c9b07304))
- **metar:** Integrate metar-taf-parser library for proper METAR decoding by @lyestarzalt([878fb74](https://github.com/lyestarzalt/x-dispatch/commit/878fb746f73188185314934a6a70b00a712240ca))
- **i18n:** Add translations for toolbar tooltips and airport panel by @lyestarzalt([5a93879](https://github.com/lyestarzalt/x-dispatch/commit/5a93879a922874ee63bffb49bfeafcb1aa07a479))
- **map:** Custom airport markers and navigation fixes by @lyestarzalt([aea0524](https://github.com/lyestarzalt/x-dispatch/commit/aea0524583e4ee0425fafea5642626f0a2163e5d))
- **map:** Use pin beacon icon for custom airports by @lyestarzalt([2705a6c](https://github.com/lyestarzalt/x-dispatch/commit/2705a6c2020fd36c7eb7b7067b8e23c03e7116e2))
- **launch:** Improve flight config UI and require start position by @lyestarzalt([bffaf43](https://github.com/lyestarzalt/x-dispatch/commit/bffaf43fdd23e8afa2d5ac612f01525e7fb14bb4))
- **logging:** Add production support logging for user diagnostics by @lyestarzalt([f7eda5c](https://github.com/lyestarzalt/x-dispatch/commit/f7eda5c04126aeac9e65c38662dcc57d3e6b5737))
- **privacy:** Add opt-out crash reporting toggle in settings by @lyestarzalt([4256210](https://github.com/lyestarzalt/x-dispatch/commit/4256210a184824592d2de8742a4c6004abe9b770))

### Bug Fixes

- Add SQLite caching for navigation data by @lyestarzalt([857d2a4](https://github.com/lyestarzalt/x-dispatch/commit/857d2a4098794798d2454b11f318713051758aca))
- Track nav data source type for Navigraph switching by @lyestarzalt([2dddb4b](https://github.com/lyestarzalt/x-dispatch/commit/2dddb4bba299c3ea93df5f19ce15fab9624dbb08))
- Add migration for source_type column in nav_file_meta by @lyestarzalt([99f66c6](https://github.com/lyestarzalt/x-dispatch/commit/99f66c607574b461193f72c3c66dbf43f422f5b2))
- Add null guards to prevent 'getLayer' errors on undefined map by @lyestarzalt([7c12be2](https://github.com/lyestarzalt/x-dispatch/commit/7c12be2f723593221dbf2720a595ed140eb64e69))
- Properly re-add layers after map style change by @lyestarzalt([ac21d62](https://github.com/lyestarzalt/x-dispatch/commit/ac21d629c98c7c1013ba09b9afa020c8f1ef1b01))
- Centralize styleVersion subscription to avoid HMR errors by @lyestarzalt([e5bbb4c](https://github.com/lyestarzalt/x-dispatch/commit/e5bbb4c298a23d8d460fcdc9687f6b979ea22b97))
- **ui:** Improve main UI layout and UX by @lyestarzalt([f549f2d](https://github.com/lyestarzalt/x-dispatch/commit/f549f2dd16b30e96a168a443f96335af9622c1ec))
- **ui:** Position FlightStrip above FlightPlanBar when visible by @lyestarzalt([5bf84cc](https://github.com/lyestarzalt/x-dispatch/commit/5bf84cc88b5cac7988960a4811a98e130248ac8f))
- Prevent programmatic map movements from disabling follow mode by @lyestarzalt([ace9a13](https://github.com/lyestarzalt/x-dispatch/commit/ace9a1324445b641bd43b3db0e06e83eb4faf168))
- Improve plane tracking and fix airport layer displacement by @lyestarzalt([cbd65c8](https://github.com/lyestarzalt/x-dispatch/commit/cbd65c823b67a1e71519fd2cee45faf768f949a6))
- Remove Sentry from preload (incompatible with sandbox) by @lyestarzalt([be00f87](https://github.com/lyestarzalt/x-dispatch/commit/be00f874375eaf244de519d29a57e645e0aa5939))
- **map:** Prevent getLayer crashes after map destruction by @lyestarzalt([71fe4ee](https://github.com/lyestarzalt/x-dispatch/commit/71fe4ee57962eef3eb4b910a4cd88e333d6064ec))
- **map:** Simplify style change handling to prevent crashes by @lyestarzalt([6dc559e](https://github.com/lyestarzalt/x-dispatch/commit/6dc559ec11422bd979835f582e59c9963824902e))
- **validation:** Allow X-Plane internal airport IDs up to 7 chars by @lyestarzalt([f5b6369](https://github.com/lyestarzalt/x-dispatch/commit/f5b63691ece1e84192ceed0189b73ac716475a4c))
- **ux:** Add tooltip to disabled Launch button by @lyestarzalt([ae01089](https://github.com/lyestarzalt/x-dispatch/commit/ae0108972f6cb9c1c9df11f04e636a83317d9d7f))
- **layout:** Restructure top bar and sidebar positioning by @lyestarzalt([98c4722](https://github.com/lyestarzalt/x-dispatch/commit/98c472259d4ca03054077c928c5f94a8c9149e8e))
- **ui:** Restore CompassWidget and fix positioning by @lyestarzalt([e284fc5](https://github.com/lyestarzalt/x-dispatch/commit/e284fc53276d9c8cb16459cdaadfed092e03b110))
- **procedures:** Improve CIFP parsing for SID/STAR/Approach accuracy by @lyestarzalt([650c20b](https://github.com/lyestarzalt/x-dispatch/commit/650c20bc71cddcdfe086c5328cfbd9c6b1943d93))
- **ui:** Restore ExplorePanel and fix route antimeridian crossing by @lyestarzalt([13112aa](https://github.com/lyestarzalt/x-dispatch/commit/13112aa83a573e0002832567d790e840790a4498))
- **airspace:** Ensure counter-clockwise winding for GeoJSON polygons by @lyestarzalt([9f2cc17](https://github.com/lyestarzalt/x-dispatch/commit/9f2cc17332c89b47da3c25e3095942ce252e5a0a))
- **airspace:** Filter out antimeridian-crossing polygons by @lyestarzalt([fd1713e](https://github.com/lyestarzalt/x-dispatch/commit/fd1713e3c75d8d25d247b4ef408e49b9c3ed0fe8))
- **readme:** Add cache-busting param to shields.io badges by @lyestarzalt([e4a3271](https://github.com/lyestarzalt/x-dispatch/commit/e4a3271b2ce76c329b2f26485bccd2d5cc26ef81))

### Refactor

- Consolidate navigation types with proper enums by @lyestarzalt([68a2c76](https://github.com/lyestarzalt/x-dispatch/commit/68a2c761e605f13355565c69db0a254c8d868af3))
- **ui:** Improve FlightPlanBar layout and interactions by @lyestarzalt([28a9173](https://github.com/lyestarzalt/x-dispatch/commit/28a9173f75ec4a11262505590fcbaaaa783a9b7d))
- Rename Sidebar to AirportInfoPanel and remove FlightPlanTab by @lyestarzalt([e3446e7](https://github.com/lyestarzalt/x-dispatch/commit/e3446e77a7d66cf6a9841aa5e7c7cb4a90b033ea))
- **compass:** Remove wind indicator, keep only heading by @lyestarzalt([0a1c747](https://github.com/lyestarzalt/x-dispatch/commit/0a1c7472b37f276328c23a63418cf916fc3643af))
- **ui:** Redesign AirportInfoPanel with better info hierarchy by @lyestarzalt([d6a4cc3](https://github.com/lyestarzalt/x-dispatch/commit/d6a4cc38665c7e95b770fc584a6e001f61ead484))
- **launch:** Redesign aircraft preview with livery navigation by @lyestarzalt([3c75994](https://github.com/lyestarzalt/x-dispatch/commit/3c75994ec66631dd34ed8b60ae9b0f9ce2a8836a))

### Documentation

- Add open source community templates by @lyestarzalt([09edf91](https://github.com/lyestarzalt/x-dispatch/commit/09edf917c8dd589092240324e6fe2dbe4657fa1d))
- **readme:** Add Discord badge, tech stack badges, and support section by @lyestarzalt([4700fc7](https://github.com/lyestarzalt/x-dispatch/commit/4700fc7c7f2ce898aaf84bddf4de7fecdccb2025))
- Add flight plan screenshot to README by @lyestarzalt([f779573](https://github.com/lyestarzalt/x-dispatch/commit/f7795733a4b35bf15e7c4717c891f6c80b2c6e4c))

### Miscellaneous

- Add Sentry source maps and conventional changelog by @lyestarzalt([7a9969b](https://github.com/lyestarzalt/x-dispatch/commit/7a9969bad13ffe51c6469cbfe67794744ace08fc))
- Update Sentry config with env vars for org/project by @lyestarzalt([c5a733f](https://github.com/lyestarzalt/x-dispatch/commit/c5a733f650fe4637ba19913b3014aed8aa5526ae))

### Release

- 1.0.0 by @github-actions[bot]([bd9e4fc](https://github.com/lyestarzalt/x-dispatch/commit/bd9e4fc3e29d9e38c54d302d0224d8fd6b5dbe51))


## v0.9.4 - 2026-02-19

### Bug Fixes

- Improve launch logging and folder picker reliability by @lyestarzalt([8866d5c](https://github.com/lyestarzalt/x-dispatch/commit/8866d5c5a367c29ab83eddc929e33e688f32fcc6))

### Release

- 0.9.4 by @github-actions[bot]([9daa964](https://github.com/lyestarzalt/x-dispatch/commit/9daa964cf460962b706fb0fc6a6f64d6f2afc922))


## v0.9.3 - 2026-02-19

### Features

- Parse startup location metadata (row code 1301) by @lyestarzalt([4dd1041](https://github.com/lyestarzalt/x-dispatch/commit/4dd104101fbf4b173fe85b7cd2af38289606b515))
- Use precise coordinates for REST API ramp spawning by @lyestarzalt([f0a6863](https://github.com/lyestarzalt/x-dispatch/commit/f0a686357bb2ae74cb4786f7d20c6dd7fb3d47a7))

### Bug Fixes

- Preserve user preferences when writing Freeflight.prf by @lyestarzalt([e9456a4](https://github.com/lyestarzalt/x-dispatch/commit/e9456a438fda22998109b2656e5eec1fead3ecc4))
- Include ws and related packages in build by @lyestarzalt([6684aeb](https://github.com/lyestarzalt/x-dispatch/commit/6684aeb7a13d8463c0816cf65381f9a74cd9962d))
- Prevent database closing on macOS window close by @lyestarzalt([d7057e1](https://github.com/lyestarzalt/x-dispatch/commit/d7057e1af40643d580b74e9400c27f04f569f2b6))

### Refactor

- Extract launch execution logic to dedicated executor module by @lyestarzalt([03a5104](https://github.com/lyestarzalt/x-dispatch/commit/03a51046cc6c1b8a2ddfa650c7cac09cb2bb5043))

### Miscellaneous

- Add TODO comments for freeflightGenerator refactoring by @lyestarzalt([de61c63](https://github.com/lyestarzalt/x-dispatch/commit/de61c634b4fb1291c34cd6849aa2b783a93a507d))

### Release

- 0.9.3 by @github-actions[bot]([154ed06](https://github.com/lyestarzalt/x-dispatch/commit/154ed06cab7bc2dfcac4dac0bed3141b19e0d8c4))


## v0.9.2 - 2026-02-19

### Bug Fixes

- Package electron-squirrel-startup for Windows builds by @lyestarzalt([ea9eb33](https://github.com/lyestarzalt/x-dispatch/commit/ea9eb332d8358b2d613a57b8bcfdd65573aec9e4))

### Release

- 0.9.2 by @github-actions[bot]([1eceb61](https://github.com/lyestarzalt/x-dispatch/commit/1eceb61682244cc3f9c750ce69268688fd2e30fa))


## v0.9.1 - 2026-02-18

### Refactor

- Architecture overhaul with TanStack Query, centralized types, and spawn fixes (#24) by @lyestarzalt in [#24](https://github.com/lyestarzalt/x-dispatch/pull/24)([800544f](https://github.com/lyestarzalt/x-dispatch/commit/800544f02f06dd2c8710872d99da4cb913d4f631))

### Release

- 0.9.1 by @github-actions[bot]([14cbe6f](https://github.com/lyestarzalt/x-dispatch/commit/14cbe6f2e59423a15fde4c7ecb7ca1fa7b12f7f1))


## v0.9.0 - 2026-02-13

### Documentation

- Update screenshots to reflect new UI by @lyestarzalt([e905f30](https://github.com/lyestarzalt/x-dispatch/commit/e905f30ffa6ce0196f6a44a7c73acd5399fa4f93))

### Release

- 0.9.0 by @github-actions[bot]([0031aa8](https://github.com/lyestarzalt/x-dispatch/commit/0031aa887d25863ee20c1e802e46c4972f07f7c6))


## v0.8.0 - 2026-02-08

### Release

- 0.8.0 by @github-actions[bot]([85545ae](https://github.com/lyestarzalt/x-dispatch/commit/85545aeb13b4a3290b4c1663cfc9d9bfc3057541))


## v0.7.0 - 2026-02-07

### Features

- **signs:** Render airport signs as proper SVG rectangles by @lyestarzalt([45a90b4](https://github.com/lyestarzalt/x-dispatch/commit/45a90b4e64e46f180e4e8ea58e48078ee9a5df09))
- **layers:** Add helipad, beacon, and tower layers by @lyestarzalt([371b1ee](https://github.com/lyestarzalt/x-dispatch/commit/371b1eebce8e6580918cc7688dc08730b8a6b7b7))
- **ui:** X-Plane design system overhaul and unit preferences by @lyestarzalt([e7b87c7](https://github.com/lyestarzalt/x-dispatch/commit/e7b87c78915707a07bff7d80dae8026e4743c02e))
- Load React DevTools in development mode by @lyestarzalt([850b472](https://github.com/lyestarzalt/x-dispatch/commit/850b472c2a2c557f82e57756f248dc8c6a9d342b))
- **db:** Add aptFileMeta table and airport metadata columns by @lyestarzalt([ca036a0](https://github.com/lyestarzalt/x-dispatch/commit/ca036a0d12c5474f0c918ebe2878135b25fb273d))
- **db:** Update table creation for new schema by @lyestarzalt([b4989cd](https://github.com/lyestarzalt/x-dispatch/commit/b4989cde4098ce1a4b79971487a4e7d34dcb83fb))
- **xplane:** Add types for apt.dat parsing by @lyestarzalt([ca9c86a](https://github.com/lyestarzalt/x-dispatch/commit/ca9c86a2579dcb30977a001b907b19d3d8794142))
- **xplane:** Add file mtime checking for cache invalidation by @lyestarzalt([af08750](https://github.com/lyestarzalt/x-dispatch/commit/af087507a0ba49f8e5e1a86ee9007391549d6987))
- **xplane:** Extract 1302 metadata during apt.dat parsing by @lyestarzalt([304cb74](https://github.com/lyestarzalt/x-dispatch/commit/304cb74c0f4eccf253e3a46a5eedcf3e241247a7))
- **xplane:** Implement batch inserts and cache checking by @lyestarzalt([3abd2cb](https://github.com/lyestarzalt/x-dispatch/commit/3abd2cb26a1416f246c170acd6320c496b7d6c10))
- **xplane:** Update clear to also clear aptFileMeta by @lyestarzalt([ad49488](https://github.com/lyestarzalt/x-dispatch/commit/ad49488ad80713b54fef219b281b163052134a01))
- Add Explore feature for discovering airports and routes (#14) (#15) by @lyestarzalt in [#15](https://github.com/lyestarzalt/x-dispatch/pull/15)([e867926](https://github.com/lyestarzalt/x-dispatch/commit/e867926237ea396f8568c06ec2c36dc1103be459))

### Bug Fixes

- **layers:** Add barIndex for approach lights and extract surface types by @lyestarzalt([f605128](https://github.com/lyestarzalt/x-dispatch/commit/f605128ff9e8550519a9450ede6351aa21998571))
- **aptParser:** Fix bezier curve parsing for smooth pavements by @lyestarzalt([7635ddd](https://github.com/lyestarzalt/x-dispatch/commit/7635ddd66c2468648c6bdc1b797ffd96c62dc878))
- **runways:** Render shoulders with default width when not specified by @lyestarzalt([e9a0abb](https://github.com/lyestarzalt/x-dispatch/commit/e9a0abbae1c08d8961a91930bb17e27363630c95))
- **linearFeature:** Airport lines not rendred properly by @lyestarzalt([dfff5c8](https://github.com/lyestarzalt/x-dispatch/commit/dfff5c8362998f3663cb6302832b75672db75a48))
- **airspace:** Improve label readability with line placement by @lyestarzalt in [#12](https://github.com/lyestarzalt/x-dispatch/pull/12)([a62ea47](https://github.com/lyestarzalt/x-dispatch/commit/a62ea479b7169faaa53316e5036c3f21e41f7147))
- CSP, sign scaling, and sign parsing issues by @lyestarzalt([99e4ba3](https://github.com/lyestarzalt/x-dispatch/commit/99e4ba3ef92d1bf11d6d64fadcf69c8f587ede6a))
- **signs:** Use constant icon size and trigger repaint after image load by @lyestarzalt([e703231](https://github.com/lyestarzalt/x-dispatch/commit/e703231eae8bd6e23327a8e1e151935533afc6bf))
- **signs:** Pre-generate all sign images before adding layer by @lyestarzalt([3f4fcd4](https://github.com/lyestarzalt/x-dispatch/commit/3f4fcd41b7c104658a2e2210401a96c090e34f19))
- **types:** Sync Aircraft interface in preload.ts with launcher types by @lyestarzalt([2572555](https://github.com/lyestarzalt/x-dispatch/commit/2572555b2487e7e28c3a44ef54488a7dde162286))

### Refactor

- **layers:** Standardize map layers with class-based architecture by @lyestarzalt([ad53489](https://github.com/lyestarzalt/x-dispatch/commit/ad534898c942da3992cf18b3678992025130fd5f))
- **nav-layers:** Consolidate config and remove legacy exports by @lyestarzalt([c90e53c](https://github.com/lyestarzalt/x-dispatch/commit/c90e53cbd28fc0e6417802acfc1d5deb8f062970))
- **signs:** Use text labels instead of SVG images, fix CSP for Google Fonts by @lyestarzalt([5b6f3c1](https://github.com/lyestarzalt/x-dispatch/commit/5b6f3c17295fa9990749bef396aaee95b0c1972d))

### Documentation

- **plans:** Add sign layer redesign spec by @lyestarzalt([5bd31ec](https://github.com/lyestarzalt/x-dispatch/commit/5bd31ec630324fc00746a67cf988ba872b3ddd02))
- Add apt.dat cache invalidation design by @lyestarzalt([0dbf129](https://github.com/lyestarzalt/x-dispatch/commit/0dbf129512098fe947d2a6a4e9206770f60589c0))
- Add implementation plan for apt.dat cache by @lyestarzalt([b541143](https://github.com/lyestarzalt/x-dispatch/commit/b541143134cbd48020d24c79df7fd3e51a997bbd))

### Miscellaneous

- Remove unused MORA and MSA layer code by @lyestarzalt([5c16639](https://github.com/lyestarzalt/x-dispatch/commit/5c1663938312e65415a9462081d439b8fac68c16))
- Disable sign layer temporarily by @lyestarzalt([6c4e68f](https://github.com/lyestarzalt/x-dispatch/commit/6c4e68fb1e10d1e8459a365b3d437ce83e9cedbd))

### Release

- 0.7.0 by @github-actions[bot]([1fe9e45](https://github.com/lyestarzalt/x-dispatch/commit/1fe9e454bf474de85ea60b93d4eccdfe229d7e61))


## v0.6.1 - 2026-02-03

### Miscellaneous

- Fix repo URLs and add macOS install note (#10) by @lyestarzalt in [#10](https://github.com/lyestarzalt/x-dispatch/pull/10)([440fb3c](https://github.com/lyestarzalt/x-dispatch/commit/440fb3c21d53d37c3b580656b747b2597ff97324))
- **ui:** Shadcn components, semantic colors, Map refactor & compass redesign  (#11) by @lyestarzalt in [#11](https://github.com/lyestarzalt/x-dispatch/pull/11)([17db16f](https://github.com/lyestarzalt/x-dispatch/commit/17db16f2c2a98a9461be69cfbd63a3a96d7aacd9))

### Release

- 0.6.1 by @github-actions[bot]([8481e37](https://github.com/lyestarzalt/x-dispatch/commit/8481e37544e8d3e065f7cc04178c24d3d76bacc7))


## v0.6.0 - 2026-02-02

### Features

- **launcher:** Add cold & dark and system time options by @lyestarzalt([6af3a33](https://github.com/lyestarzalt/x-dispatch/commit/6af3a3322136565f5f8689fec1f6adf10905fb7c))

### Documentation

- Enhance README with logo and screenshots by @lyestarzalt([af08967](https://github.com/lyestarzalt/x-dispatch/commit/af08967bfb7bb6a4e330993b93762d9a3085d8dc))

### Release

- 0.6.0 by @github-actions[bot]([609a2a3](https://github.com/lyestarzalt/x-dispatch/commit/609a2a3ba0f136cb3ae25902cdd31a05aa6a7863))


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
