# X-Dispatch Community Modules

X-Dispatch supports a modular architecture so features can be developed and maintained by the community.

## Concepts

- **Bundled module** (`kind: bundled`): shipped with the app but **not part of core boot** — IPC, protocols, and map hooks register only when enabled (example: `sia-france`).
- **Core module** (`kind: core`): reserved for features that must always run with the app.
- **External module** (`kind: external`): installed from a `.zip` archive or a GitHub repository.
- **Trusted store**: repository list in `registry/modules.json`.

## Module manifest

Each module archive must include an `x-dispatch-module.json` file. Types: `src/lib/modules/types.ts`.

- `kind`: `core`, `bundled`, or `external`
- `defaultEnabled` (bundled): initial on/off for new installs (default `false`)

## Bundled module in this repo

1. Code under `src/modules/<module-id>/` (lib, main, renderer).
2. Contributions registered in `src/lib/modules/registry.tsx`.
3. Manifest passed to `initModuleManager([...])` in `src/main.ts`.
4. `main/lifecycle.ts` registers/unregisters IPC and protocols when toggled.

## Install external modules

**Settings → Modules** — ZIP or GitHub URL. Catalog entries live in `registry/modules.json`.
