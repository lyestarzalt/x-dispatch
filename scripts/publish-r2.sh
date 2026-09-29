#!/usr/bin/env bash
# Publishes releases to the x-dispatch-downloads R2 bucket, served at dl.x-dispatch.app.
#
#   publish-r2.sh release <stable|rc> <tag> <assets-dir> <notes-file>
#   publish-r2.sh archive <stable|rc> <tag> <assets-dir> <notes-file>   same, pointers untouched
#   publish-r2.sh assets  <tag> <assets-dir>                            add or replace rebuilt assets
#   publish-r2.sh notes   <tag> <notes-file>                            replace the notes
#   publish-r2.sh check                                                 verify credentials, no writes
#
# Bucket layout:
#   releases/<tag>/<asset>          installers and Squirrel packages
#   releases/<tag>/sha256sums.txt
#   releases/<tag>/notes.md
#   releases/<tag>/manifest.json    version, channel, date, notes, files with size and sha256
#   win32/x64/RELEASES + *.nupkg    Squirrel feed for update-electron-app, latest stable only
#   latest.json / latest-rc.json    copy of the newest manifest per channel
#
# Pointers are written after the files they reference, so a client never sees a
# version whose files are not uploaded yet.
set -euo pipefail

BUCKET="${R2_BUCKET:-x-dispatch-downloads}"
PUBLIC_BASE="${R2_PUBLIC_BASE:-https://dl.x-dispatch.app}"

for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if [ -z "${!var:-}" ]; then
    echo "::error title=R2 credentials missing::$var is not set."
    exit 1
  fi
done

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
# R2 rejects the default checksum headers of recent AWS CLI versions.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Installers keep their URL when a rebuild replaces them, so edge copies must expire.
ASSET_CACHE="public, max-age=86400"
IMMUTABLE="public, max-age=31536000, immutable"
MUTABLE="public, max-age=60, must-revalidate"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

s3() {
  local cmd="$1"
  shift
  [ "$cmd" = "cp" ] && set -- --only-show-errors "$@"
  aws s3 "$cmd" --endpoint-url "$ENDPOINT" "$@"
}

put() {
  local src="$1" key="$2" cache="$3" type="${4:-}"
  if [ -n "$type" ]; then
    s3 cp "$src" "s3://$BUCKET/$key" --cache-control "$cache" --content-type "$type"
  else
    s3 cp "$src" "s3://$BUCKET/$key" --cache-control "$cache"
  fi
}

fetch() { s3 cp "s3://$BUCKET/$1" "$2" 2>/dev/null; }

summary() { echo "$1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }

pointer_key() { [ "$1" = "rc" ] && echo "latest-rc.json" || echo "latest.json"; }

is_package() { case "$1" in RELEASES | *.nupkg) return 0 ;; *) return 1 ;; esac; }

# Written by this script from the manifest; copies in the assets dir are ignored.
is_generated() { case "$1" in sha256sums.txt | notes.md | manifest.json) return 0 ;; *) return 1 ;; esac; }

# Prints one JSON object per downloadable file in the directory.
describe_files() {
  local dir="$1" tag="$2" f name
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    is_package "$name" && continue
    is_generated "$name" && continue
    jq -n \
      --arg name "$name" \
      --argjson size "$(wc -c < "$f" | tr -d ' ')" \
      --arg sha256 "$(sha256sum "$f" | cut -d' ' -f1)" \
      --arg url "$PUBLIC_BASE/releases/$tag/$name" \
      '{ name: $name, size: $size, sha256: $sha256, url: $url }'
  done
}

upload_assets() {
  local dir="$1" tag="$2" f
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    is_generated "$(basename "$f")" && continue
    put "$f" "releases/$tag/$(basename "$f")" "$ASSET_CACHE"
  done
}

write_sums() {
  local manifest="$1" tag="$2"
  jq -r '.files[] | "\(.sha256)  \(.name)"' "$manifest" > "$WORK/sha256sums.txt"
  put "$WORK/sha256sums.txt" "releases/$tag/sha256sums.txt" "$MUTABLE" "text/plain; charset=utf-8"
}

write_manifest() {
  local manifest="$1" tag="$2"
  put "$manifest" "releases/$tag/manifest.json" "$MUTABLE" "application/json"
  jq -r '.notes' "$manifest" > "$WORK/notes.md"
  put "$WORK/notes.md" "releases/$tag/notes.md" "$MUTABLE" "text/markdown; charset=utf-8"
  write_sums "$manifest" "$tag"
}

publish_feed() {
  local dir="$1" pkg
  if [ ! -f "$dir/RELEASES" ]; then
    echo "::warning title=No Squirrel feed::RELEASES missing, the Windows feed still points at the previous version."
    return
  fi
  for pkg in "$dir"/*.nupkg; do
    [ -f "$pkg" ] || continue
    put "$pkg" "win32/x64/$(basename "$pkg")" "$IMMUTABLE"
  done
  put "$dir/RELEASES" "win32/x64/RELEASES" "$MUTABLE" "text/plain; charset=utf-8"
}

# Rewrites the channel pointer only when it already names this tag.
refresh_pointer_if_current() {
  local manifest="$1" tag channel key
  tag="$(jq -r '.tag' "$manifest")"
  channel="$(jq -r '.channel' "$manifest")"
  key="$(pointer_key "$channel")"
  if fetch "$key" "$WORK/pointer.json" && [ "$(jq -r '.tag' "$WORK/pointer.json")" = "$tag" ]; then
    put "$manifest" "$key" "$MUTABLE" "application/json"
    echo "current"
  fi
}

cmd_release() {
  local mode="$1" channel="$2" tag="$3" dir="$4" notes_file="$5"
  case "$channel" in stable | rc) ;; *) echo "::error::Channel must be stable or rc, got '$channel'."; exit 1 ;; esac
  [ -f "$notes_file" ] || { echo "::error::Notes file $notes_file not found."; exit 1; }

  local published_at="${PUBLISHED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
  describe_files "$dir" "$tag" | jq -s \
    --arg version "${tag#v}" \
    --arg tag "$tag" \
    --arg channel "$channel" \
    --arg published_at "$published_at" \
    --rawfile notes "$notes_file" \
    '{ schema: 1, version: $version, tag: $tag, channel: $channel,
       published_at: $published_at, notes: $notes, files: (. | sort_by(.name)) }' \
    > "$WORK/manifest.json"

  if [ "$(jq '.files | length' "$WORK/manifest.json")" -eq 0 ]; then
    echo "::error::No release files found in $dir."
    exit 1
  fi

  upload_assets "$dir" "$tag"
  write_manifest "$WORK/manifest.json" "$tag"

  if [ "$mode" = "release" ]; then
    [ "$channel" = "stable" ] && publish_feed "$dir"
    put "$WORK/manifest.json" "$(pointer_key "$channel")" "$MUTABLE" "application/json"
    summary "- :white_check_mark: Published \`$tag\` to R2 ($(pointer_key "$channel"))"
  else
    summary "- :white_check_mark: Archived \`$tag\` to R2"
  fi
}

cmd_assets() {
  local tag="$1" dir="$2"
  fetch "releases/$tag/manifest.json" "$WORK/old.json" || {
    echo "::error::releases/$tag/manifest.json not found, publish or archive $tag first."
    exit 1
  }

  describe_files "$dir" "$tag" | jq -s '.' > "$WORK/new-files.json"
  jq --slurpfile added "$WORK/new-files.json" \
    '.files = ([.files[], $added[0][]] | group_by(.name) | map(last))' \
    "$WORK/old.json" > "$WORK/manifest.json"

  upload_assets "$dir" "$tag"
  write_manifest "$WORK/manifest.json" "$tag"

  if [ "$(refresh_pointer_if_current "$WORK/manifest.json")" = "current" ] \
    && [ "$(jq -r '.channel' "$WORK/manifest.json")" = "stable" ] \
    && [ -f "$dir/RELEASES" ]; then
    publish_feed "$dir"
  fi
  summary "- :white_check_mark: Updated \`$tag\` assets on R2"
}

cmd_notes() {
  local tag="$1" notes_file="$2"
  fetch "releases/$tag/manifest.json" "$WORK/old.json" || {
    echo "::error::releases/$tag/manifest.json not found, publish or archive $tag first."
    exit 1
  }
  jq --rawfile notes "$notes_file" '.notes = $notes' "$WORK/old.json" > "$WORK/manifest.json"
  write_manifest "$WORK/manifest.json" "$tag"
  refresh_pointer_if_current "$WORK/manifest.json" > /dev/null
  echo "channel=$(jq -r '.channel' "$WORK/manifest.json")" >> "${GITHUB_OUTPUT:-/dev/null}"
  summary "- :white_check_mark: Updated \`$tag\` notes on R2"
}

cmd_check() {
  s3 ls "s3://$BUCKET/" > /dev/null
  summary "- :white_check_mark: R2 credentials can reach \`$BUCKET\`"
}

case "${1:-}" in
  release | archive) cmd_release "$1" "$2" "$3" "$4" "$5" ;;
  assets) cmd_assets "$2" "$3" ;;
  notes) cmd_notes "$2" "$3" ;;
  check) cmd_check ;;
  *) echo "Usage: publish-r2.sh release|archive|assets|notes|check ..." >&2; exit 2 ;;
esac
