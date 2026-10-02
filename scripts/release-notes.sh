#!/usr/bin/env bash
# Release notes for pilots live in the "## [Unreleased]" section of
# CHANGELOG.md (Keep a Changelog format), written before running the Release
# workflow. They go to Discord, the app's update notice and the website; the
# commit list only appears on the GitHub release.
#
#   release-notes.sh check <changelog>                    fail if Unreleased has no notes
#   release-notes.sh print <changelog>                    Unreleased notes, empty sections dropped
#   release-notes.sh release <version> <date> <changelog> move Unreleased into a new version
set -euo pipefail

# Lines of the Unreleased section, up to the next "## " heading or the
# link references at the bottom.
unreleased_section() {
  awk '
    /^## \[Unreleased\]/ { inside = 1; next }
    inside && (/^## / || /^\[[^]]+\]: /) { exit }
    inside { print }
  ' "$1"
}

# Drops <!-- --> comments and "### " sections without any "- " item, and trims
# blank lines at both ends.
clean_notes() {
  awk '
    /<!--/ { comment = 1 }
    comment { if (/-->/) comment = 0; next }
    /^### / { flush(); heading = $0; body = ""; items = 0; next }
    {
      body = body $0 "\n"
      if ($0 ~ /^[[:space:]]*[-*] /) items++
    }
    function flush() {
      if (heading != "" && items > 0) out = out (out == "" ? "" : "\n") heading "\n" body
    }
    END {
      flush()
      gsub(/\n\n\n+/, "\n\n", out)
      sub(/^\n+/, "", out)
      sub(/\n+$/, "", out)
      if (out != "") print out
    }
  '
}

print_notes() {
  unreleased_section "$1" | clean_notes
}

cmd="${1:-}"
case "$cmd" in
  check)
    if [ -z "$(print_notes "${2:?changelog}")" ]; then
      echo "::error title=No release notes::Write the notes for pilots under ## [Unreleased] in CHANGELOG.md, then run the release again." >&2
      exit 1
    fi
    ;;
  print)
    print_notes "${2:?changelog}"
    ;;
  release)
    version="${2:?version}" date="${3:?date}" file="${4:?changelog}"
    NOTES="$(print_notes "$file")" VERSION="$version" DATE="$date" awk '
      # Empty Unreleased on top, then the new version with the notes.
      /^## \[Unreleased\]/ {
        print
        print ""
        print "## [" ENVIRON["VERSION"] "] - " ENVIRON["DATE"]
        print ""
        print ENVIRON["NOTES"]
        print ""
        skipping = 1
        next
      }
      skipping && (/^## / || /^\[[^]]+\]: /) { skipping = 0 }
      skipping { next }
      # [unreleased]: <repo>/compare/vPREV...HEAD -> compare from the new tag,
      # and a link for the new version right below it.
      /^\[unreleased\]: .*\/compare\/.*\.\.\.HEAD$/ {
        base = $2
        sub(/\/compare\/.*/, "", base)
        prev = $2
        sub(/.*\/compare\//, "", prev)
        sub(/\.\.\.HEAD$/, "", prev)
        print "[unreleased]: " base "/compare/v" ENVIRON["VERSION"] "...HEAD"
        print "[" ENVIRON["VERSION"] "]: " base "/compare/" prev "...v" ENVIRON["VERSION"]
        next
      }
      { print }
    ' "$file" > "$file.tmp"
    mv "$file.tmp" "$file"
    ;;
  *)
    echo "usage: release-notes.sh check|print|release ..." >&2
    exit 2
    ;;
esac
