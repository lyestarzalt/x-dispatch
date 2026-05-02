export function buildHelpText(version: string): string {
  return `X-Dispatch v${version} — flight dispatch for X-Plane 12

USAGE
  X-Dispatch [options]

OPTIONS
  --reset-cache         Wipe the local airport/nav cache and rebuild on next
                        start. Useful for forcing a fresh load of apt.dat
                        and nav data after scenery changes.

  --xp-arg=<arg>        Append <arg> to the X-Plane launch args for this
                        session. Repeat the flag once per X-Plane arg —
                        each --xp-arg= takes exactly one value, no
                        comma-separated lists. Combines with the args saved
                        in Settings (Settings args first, CLI args appended
                        after, no dedupe).

                        Example (single):
                          X-Plane          : X-Plane --no_sprites
                          X-Dispatch       : X-Dispatch --xp-arg=--no_sprites

                        Example (multiple — repeat the flag):
                          X-Plane          : X-Plane --fps_test=2 --no_pixel_counters
                          X-Dispatch       : X-Dispatch --xp-arg=--fps_test=2 --xp-arg=--no_pixel_counters

  -h, --help            Print this help and exit.
  -v, --version         Print the version and exit.

INVOCATION (packaged builds)
  macOS                 X-Dispatch.app/Contents/MacOS/X-Dispatch [options]
  Windows               start /wait X-Dispatch.exe [options]
  Linux                 ./X-Dispatch [options]

NOTES
  CLI flags do not persist — they apply only to the current session.
  Args added via --xp-arg appear in Settings → Launch args under
  "Session args (from CLI)" while X-Dispatch is running.

DOCS
  https://github.com/lyestarzalt/x-dispatch
`;
}

export function buildVersionText(version: string): string {
  return `X-Dispatch ${version}\n`;
}
