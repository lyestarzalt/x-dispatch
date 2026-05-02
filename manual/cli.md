# Command-line flags

X-Dispatch accepts a small set of command-line flags for power users and external integrations. All flags are session-only — nothing is persisted between launches.

## Available flags

| Flag              | Effect                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--reset-cache`   | Wipe the local airport/nav cache before init. The loading screen runs from scratch. Useful after changing custom scenery. |
| `--xp-arg=<arg>`  | Append `<arg>` to the X-Plane launch args for this session. Repeatable.                                                   |
| `-h`, `--help`    | Print this help and exit.                                                                                                 |
| `-v`, `--version` | Print the version and exit.                                                                                               |

## Running with flags

| Platform    | Command                                            |
| ----------- | -------------------------------------------------- |
| **macOS**   | `X-Dispatch.app/Contents/MacOS/X-Dispatch [flags]` |
| **Windows** | `start /wait X-Dispatch.exe [flags]`               |
| **Linux**   | `./X-Dispatch [flags]`                             |

## Forwarding flags to X-Plane (`--xp-arg=`)

`--xp-arg=` lets you forward an arg to X-Plane on the next launch you trigger from the X-Dispatch UI. **Repeat the flag once per X-Plane arg** — each `--xp-arg=` takes exactly one value. No comma-separated lists.

| You'd run X-Plane like                     | You run X-Dispatch like                                         |
| ------------------------------------------ | --------------------------------------------------------------- |
| `X-Plane --no_sprites`                     | `X-Dispatch --xp-arg=--no_sprites`                              |
| `X-Plane --fps_test=2 --no_pixel_counters` | `X-Dispatch --xp-arg=--fps_test=2 --xp-arg=--no_pixel_counters` |

Session args appear in **Settings → X-Plane → Launch args** under "Session args (from CLI)" while X-Dispatch is running. They combine with your saved Settings args (saved first, CLI appended after).

## Wiping the cache (`--reset-cache`)

If a custom scenery change isn't reflected in X-Dispatch, run with `--reset-cache` to force a full re-scan of `apt.dat` files and nav data. The loading screen shows the rebuild progress.

## Developer shortcut

```bash
npm run start:fresh
```

Launches X-Dispatch in dev mode with `--reset-cache`. Equivalent to `electron-forge start -- --reset-cache`.

## Notes

- Unknown flags are logged with a "did you mean..." suggestion (e.g. `--rest-cache` → `--reset-cache`) but don't block startup.
- Electron/Chromium debug flags (`--inspect`, `--remote-debugging-port`, `--no-sandbox`, etc.) pass through silently.
- When called via `--help` or `--version`, X-Dispatch prints to stdout and exits without opening a window.
