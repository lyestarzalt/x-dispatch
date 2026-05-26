# X-Dispatch Community Modules

## Concepts

- **Bundled module** (`kind: bundled`): shipped with the app, optional at runtime.
- **External module** (`kind: external`): installed from ZIP or GitHub.
- **Trusted store**: `registry/modules.json`.

## Phase 1

- Declarative manifest `x-dispatch-module.json`
- Main-process lifecycle (IPC, protocols) on enable/disable
- Settings sidebar tab per enabled module (`contributions.settingsTabs`)

## Phase 2

### 2a — Manifest-driven UI (done)

- Manifest declares `settingsTabs`, `airportTabs`, etc.
- Core maps `moduleId` → React entrypoints in `moduleUiRegistry.tsx`
- SIA/VAC UI lives under `src/modules/sia-france/renderer/` (core re-exports kept for compatibility)

### 2b — External renderer bundles (in progress)

- Optional `renderer` field in manifest (e.g. `dist/renderer.bundle.js`)
- `modulesAPI.getRendererBundlePath` resolves the file under `userData/community-modules/<id>/<version>/`
- `moduleRendererLoader.ts` — execution via custom protocol (next step)
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
