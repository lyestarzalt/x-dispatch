# X-Dispatch Community Modules

## Concepts

- **Bundled module** (`kind: bundled`): shipped with the app, optional at runtime.
- **External module** (`kind: external`): installed from ZIP or GitHub.
- **Trusted store**: `registry/modules.json`.
- **Install location (external)**: installed to `app.getPath('userData')/community-modules/<id>/<version>/`.
- **Runtime state (external)**: persisted in `modules-state.json` under the same `community-modules/` folder.

## Phase 1

- Declarative manifest `x-dispatch-module.json`
- Enable/disable lifecycle is host-side: when a module is toggled, X-Dispatch can register/unregister IPC, start/stop runtimes, etc.
  Today, lifecycle hooks are wired in X-Dispatch core (see `src/main/modulesIpc.ts` + `src/modules/*/main/lifecycle.ts`).
- Settings sidebar tab and other contributions declared in the manifest (`contributions.settingsTabs`, `toolbarToggles`, `mapHooks`, ...)
  but the actual behavior depends on what X-Dispatch core supports for that `moduleId`.

## Phase 2

### 2a — Manifest-driven UI (done)

- Manifest declares `contributions.settingsTabs`, `airportTabs`, etc.
- Core maps `moduleId` → React entrypoints in `src/lib/modules/moduleUiRegistry.tsx` and decides which React components can render.
- Renderer components still live in X-Dispatch core: adding a new functional `moduleId` usually requires a core PR that updates this mapping (and any toolbar/map hooks).
- SIA/VAC UI lives under `src/modules/sia-france/renderer/` (core re-exports kept for compatibility)

### 2b — External renderer bundles (in progress)

- Optional `renderer` field in manifest (e.g. `dist/renderer.bundle.js`)
- `modulesAPI.getRendererBundlePath` resolves the file under `userData/community-modules/<id>/<version>/`
- `moduleRendererLoader.ts` — execution not implemented yet.
  The loader currently returns `null`, so external renderer bundles are not executed yet.
- Module authors: build with Vite library mode; see [4SLSL/vac-sia](https://github.com/4SLSL/vac-sia) `host-ui/`

## Module manifest

See `src/lib/modules/types.ts`. Example:

```json
{
  "id": "sia-france",
  "kind": "external",
  "contributions": {
    "settingsTabs": [{ "tabId": "sia-france", "labelKey": "modules.siaFrance.settingsTab" }],
    "airportTabs": [{ "tabId": "vac" }],
    "toolbarToggles": [{ "toggleId": "vac-overlay" }],
    "mapHooks": [{ "hookId": "vac-overlay" }],
    "protocols": [{ "scheme": "vac-pdf" }]
  }
}
```

## Bundled development

1. Code under `src/modules/<id>/` in x-dispatch
2. Register UI in `moduleUiRegistry.tsx`
3. Register lifecycle in `src/main.ts` + `initModuleManager`
4. Mirror to [4SLSL/vac-sia](https://github.com/4SLSL/vac-sia) for distribution

## External module packaging (ZIP / GitHub)

For `kind: external`, your release ZIP must include:

1. `x-dispatch-module.json` at the ZIP root (mandatory)
2. Any extra files you want to ship (assets, `bin/`, etc.)
3. Optional `manifest.renderer` target file (Phase 2b — currently not executed yet)

The app will install the ZIP by relocating the folder containing `x-dispatch-module.json` to:

`<userData>/community-modules/<id>/<version>/`

## What community authors can do today

- Ship/install a module and have it appear in the Modules list (enabled/disabled + persisted state).
- Declare manifest `contributions` (settings tabs labels, toolbar toggles, map hook ids).

But “end-to-end” behavior still requires X-Dispatch core support for that `moduleId` in:

- `moduleUiRegistry.tsx` (rendering Settings/Airport tabs)
- toolbar/map hook registries (e.g. `src/lib/modules/registry.tsx`) + their renderers/layers
- host-side runtime/lifecycle wiring (IPC handlers) when the module needs it
