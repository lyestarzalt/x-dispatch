#!/usr/bin/env bash
# Prepares a macOS CI runner to sign and notarize the app with a Developer ID.
#
# Reads the GitHub secrets from the environment:
#   MAC_CERT_P12          the "Developer ID Application" certificate with its private
#                         key, exported from Keychain Access as .p12 and base64-encoded
#   MAC_CERT_PASSWORD     the password given at export
#   APPLE_API_KEY_P8      an App Store Connect API key (.p8 contents, role Developer)
#   APPLE_API_KEY_ID      its key ID
#   APPLE_API_ISSUER_ID   its issuer ID
#
# Puts the certificate in a keychain of its own and stores the notary credentials
# there, then hands pack-velopack.sh what it needs through $GITHUB_ENV:
#   MAC_SIGN_IDENTITY     the certificate's name, as codesign wants it
#   MAC_KEYCHAIN          the keychain's path
#   MAC_NOTARY_PROFILE    the notarytool profile name
#
# Without MAC_CERT_P12 it does nothing, and the app is signed ad hoc as before: forks
# and local packs keep working, and the release stays buildable until the Apple
# Developer account is active.
set -euo pipefail

if [ -z "${MAC_CERT_P12:-}" ]; then
  echo "::notice::MAC_CERT_P12 is not set; the Mac app will be signed ad hoc."
  exit 0
fi
for name in MAC_CERT_PASSWORD APPLE_API_KEY_P8 APPLE_API_KEY_ID APPLE_API_ISSUER_ID; do
  [ -n "${!name:-}" ] || { echo "::error::$name is not set but MAC_CERT_P12 is."; exit 1; }
done

WORK="${RUNNER_TEMP:-$(mktemp -d)}"
KEYCHAIN="$WORK/x-dispatch-signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -hex 24)"
CERT="$WORK/developer-id.p12"
API_KEY="$WORK/AuthKey_$APPLE_API_KEY_ID.p8"
PROFILE=x-dispatch-notary

printf '%s' "$MAC_CERT_P12" | base64 --decode > "$CERT"
printf '%s' "$APPLE_API_KEY_P8" > "$API_KEY"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$CERT" -k "$KEYCHAIN" -P "$MAC_CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
# Lets codesign use the key without a GUI prompt.
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" > /dev/null
# The keychain goes first in the search list so codesign and notarytool find it.
security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" \
  | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -n 1)"
[ -n "$IDENTITY" ] || { echo "::error::No 'Developer ID Application' certificate in the .p12."; exit 1; }

xcrun notarytool store-credentials "$PROFILE" --key "$API_KEY" --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER_ID" --keychain "$KEYCHAIN" > /dev/null

rm -f "$CERT" "$API_KEY"

{
  echo "MAC_SIGN_IDENTITY=$IDENTITY"
  echo "MAC_KEYCHAIN=$KEYCHAIN"
  echo "MAC_NOTARY_PROFILE=$PROFILE"
} >> "${GITHUB_ENV:-/dev/stdout}"
echo "Signing as $IDENTITY"
