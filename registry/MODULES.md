# X-Dispatch Community Modules

## Concepts

- **Bundled module** (`kind: bundled`): shipped with the app, optional at runtime.
- **External module** (`kind: external`): installed from ZIP or GitHub.
- **Trusted store**: `registry/modules.json`.

## Phase 1 (current)

- Declarative manifest `x-dispatch-module.json`
- Main-process lifecycle (IPC, protocols) on enable/disable
- UI via `moduleUiRegistry.tsx` for bundled modules
- Settings sidebar tab per enabled module (`contributions.settingsTabs`)

## Phase 2

### 2a — Manifest-driven UI (in progress)

- Manifest declares `settingsTabs`, `airportTabs`, etc.
- Core maps `moduleId` → React entrypoints in `src/lib/modules/moduleUiRegistry.tsx`
- External modules still need bundled UI in the app OR install path with pre-built bundle

### 2b — External renderer bundles (planned)

- Optional `renderer` field in manifest (e.g. `renderer.bundle.js`)
- Build pipeline for module authors (Vite library mode)
- Secure load from `userData/community-modules/<id>/<version>/`
- Signature / trusted-store verification before execution

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
