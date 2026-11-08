#!/usr/bin/env bash
# Turns the app Forge packaged (out/X-Dispatch-<platform>-<arch>) into a Velopack release:
# the installer people download (Setup.exe, AppImage, dmg), the update feed for
# dl.x-dispatch.app/updates, and on Windows the Squirrel RELEASES file and full package
# that move old Squirrel installs over.
#
#   pack-velopack.sh <stable|rc> <assets-dir> <feed-dir>
#
# VELOPACK_NO_DELTA=1 packs without the previous release (a rebuild of a version the
# feed already has).
#
# The version is read from package.json, which the workflow has already set.
# Channels match updateChannel() in src/lib/updater/channel.ts: win, linux-<arch> and
# darwin-<arch>, each with an -rc twin for release candidates.
set -euo pipefail

KIND="$1"
ASSETS="$2"
FEED="$3"
UPDATES_URL="${UPDATES_URL:-https://dl.x-dispatch.app/updates}"

case "$KIND" in stable | rc) ;; *) echo "::error::Kind must be stable or rc, got '$KIND'."; exit 1 ;; esac

VERSION="$(node -p "require('./package.json').version")"
# vpk and the velopack module the app ships must be the same version.
VPK_VERSION="$(node -p "require('./node_modules/velopack/package.json').version")"

case "$(uname -m)" in
  x86_64 | amd64) ARCH=x64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *) echo "::error::Unsupported architecture $(uname -m)."; exit 1 ;;
esac

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    BASE=win
    # --verbose: vpk 1.2.161 logs an unreadable --icon only at debug level, then ships
    # Setup.exe without one. icon.ico must keep an AND mask on every BMP frame.
    PLATFORM_ARGS=(--packDir "out/X-Dispatch-win32-$ARCH" --mainExe x-dispatch.exe
      --icon assets/icon.ico --runtime "win-$ARCH" --noPortable --verbose)
    INSTALLER_GLOB='*-Setup.exe'
    INSTALLER_NAME="X-Dispatch-$VERSION-windows-$ARCH.exe"
    ;;
  Linux)
    # TODO: vpk's AppImage has no .desktop MimeType, so xdispatch:// links and .fms files
    # are not registered (the Forge AppImage did). Pack a prepared X-Dispatch.AppDir with
    # our own .desktop file instead of the plain folder.
    BASE="linux-$ARCH"
    PLATFORM_ARGS=(--packDir "out/X-Dispatch-linux-$ARCH" --mainExe x-dispatch
      --icon assets/icon.png --runtime "linux-$ARCH" --categories Utility)
    INSTALLER_GLOB='*.AppImage'
    INSTALLER_NAME="X-Dispatch-$VERSION-linux-$ARCH.AppImage"
    ;;
  Darwin)
    BASE="darwin-$ARCH"
    APP="out/X-Dispatch-darwin-$ARCH/X-Dispatch.app"
    [ -d "$APP" ] || { echo "::error::$APP not found."; exit 1; }
    # vpk signs the app after adding its updater, so the bundle's signature stays whole.
    # With a Developer ID from mac-signing-keychain.sh it also notarizes the app and the
    # update package; without one it signs ad hoc ("-") and macOS asks to open the app
    # like any unsigned app.
    PLATFORM_ARGS=(--packDir "$APP" --mainExe "$(ls "$APP/Contents/MacOS" | head -n 1)"
      --icon assets/icon.icns --runtime "osx-$ARCH" --noInst
      --signAppIdentity "${MAC_SIGN_IDENTITY:--}" --signEntitlements packaging/mac.entitlements)
    if [ -n "${MAC_SIGN_IDENTITY:-}" ]; then
      PLATFORM_ARGS+=(--notaryProfile "$MAC_NOTARY_PROFILE" --keychain "$MAC_KEYCHAIN")
    fi
    INSTALLER_GLOB='*-Portable.zip'
    INSTALLER_NAME="X-Dispatch-$VERSION-$([ "$ARCH" = arm64 ] && echo mac-apple-silicon || echo mac-intel).dmg"
    ;;
  *) echo "::error::Unsupported platform $(uname -s)."; exit 1 ;;
esac

CHANNEL="$BASE"
[ "$KIND" = "rc" ] && CHANNEL="$BASE-rc"

export PATH="$PATH:$HOME/.dotnet/tools"
command -v vpk > /dev/null || dotnet tool install --global vpk --version "$VPK_VERSION" > /dev/null
if ! command vpk --skip-updates -h | grep -qF "Velopack CLI $VPK_VERSION,"; then
  echo "::error::vpk must be $VPK_VERSION, the velopack version the app ships."
  exit 1
fi
vpk() { command vpk --skip-updates "$@"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The release people have now, so the new one carries a small delta from it.
if [ "${VELOPACK_NO_DELTA:-}" != "1" ]; then
  vpk download http --url "$UPDATES_URL" --channel "$CHANNEL" --outputDir "$WORK" --allowEmptyChannel
fi
previous="$(ls "$WORK")"

vpk pack --packId XDispatch --packTitle X-Dispatch --packAuthors "Lyes Tarzalt" \
  --packVersion "$VERSION" --channel "$CHANNEL" --outputDir "$WORK" --yes "${PLATFORM_ARGS[@]}"

mkdir -p "$ASSETS" "$FEED"
installer="$(find "$WORK" -maxdepth 1 -name "$INSTALLER_GLOB" | head -n 1)"
[ -n "$installer" ] || { echo "::error::vpk made no installer matching $INSTALLER_GLOB."; exit 1; }
if [ "$BASE" = "darwin-$ARCH" ]; then
  # The dmg holds the app as vpk left it, updater included, so installs from it update.
  mkdir "$WORK/dmg"
  ditto -x -k "$installer" "$WORK/dmg"
  codesign --verify --deep --strict --verbose=2 "$WORK/dmg/X-Dispatch.app"
  if [ -n "${MAC_SIGN_IDENTITY:-}" ]; then
    # The ticket travels with the app, so Gatekeeper passes it offline too.
    xcrun stapler staple "$WORK/dmg/X-Dispatch.app"
    spctl --assess --type execute --verbose=2 "$WORK/dmg/X-Dispatch.app"
  fi
  ln -s /Applications "$WORK/dmg/Applications"
  hdiutil create -volname X-Dispatch -srcfolder "$WORK/dmg" -fs HFS+ -format ULFO -ov \
    "$ASSETS/$INSTALLER_NAME"
  if [ -n "${MAC_SIGN_IDENTITY:-}" ]; then
    # vpk only knows the app and its packages; the dmg is ours to sign and notarize.
    codesign --sign "$MAC_SIGN_IDENTITY" --keychain "$MAC_KEYCHAIN" --timestamp "$ASSETS/$INSTALLER_NAME"
    xcrun notarytool submit "$ASSETS/$INSTALLER_NAME" --keychain-profile "$MAC_NOTARY_PROFILE" \
      --keychain "$MAC_KEYCHAIN" --wait
    xcrun stapler staple "$ASSETS/$INSTALLER_NAME"
    spctl --assess --type open --context context:primary-signature --verbose=2 "$ASSETS/$INSTALLER_NAME"
  fi
else
  cp "$installer" "$ASSETS/$INSTALLER_NAME"
fi

# Feed: this version's full package and delta, and a release list naming only them.
# The previous full package was needed to build the delta; clients apply the delta to
# the copy they already have, so the host no longer keeps it.
for f in "$WORK"/*.nupkg; do
  name="$(basename "$f")"
  grep -qxF "$name" <<< "$previous" && continue
  cp "$f" "$FEED/"
done
node -e '
  const [list, out, version] = process.argv.slice(1);
  const feed = JSON.parse(require("fs").readFileSync(list, "utf8").replace(/^﻿/, ""));
  feed.Assets = feed.Assets.filter((a) => a.Version === version);
  require("fs").writeFileSync(out, JSON.stringify(feed));
' "$WORK/releases.$CHANNEL.json" "$FEED/releases.$CHANNEL.json" "$VERSION"

# Old Squirrel installs update from win32/x64 (stable only) and migrate to Velopack;
# they only ever need the newest package.
if [ "$CHANNEL" = "win" ]; then
  grep -aF " XDispatch-$VERSION-full.nupkg " "$WORK/RELEASES" > "$ASSETS/RELEASES"
  cp "$WORK/XDispatch-$VERSION-full.nupkg" "$ASSETS/"
fi

echo "Packed $VERSION on channel $CHANNEL"
ls -la "$ASSETS" "$FEED"
