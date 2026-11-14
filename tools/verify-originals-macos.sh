#!/bin/bash
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p original-installers validation
curl --fail --location --retry 5 --connect-timeout 30 --max-time 900 \
  --output original-installers/Clash.Verge_2.5.10_x64.dmg \
  'https://github.com/clash-verge-rev/clash-verge-rev/releases/download/v2.5.10/Clash.Verge_2.5.10_x64.dmg'
curl --fail --location --retry 5 --connect-timeout 30 --max-time 900 \
  --output original-installers/Codex-darwin-x64-26.623.141536.zip \
  'https://persistent.oaistatic.com/codex-app-prod/Codex-darwin-x64-26.623.141536.zip'

cat > original-installers/SHA256SUMS.txt <<'SUMS'
b1d6938680f3e411b5961e56591faaa92c95e9676f54ebfdfa98b7eab374023e  Clash.Verge_2.5.10_x64.dmg
5a8eb9bca0c021b994e56c93ef3502bdbc105975bcb83f99aef40f2ae56d48cc  Codex-darwin-x64-26.623.141536.zip
SUMS
(cd original-installers && shasum -a 256 -c SHA256SUMS.txt)

work_dir=$(mktemp -d "$RUNNER_TEMP/original-app-check.XXXXXXXX")
mount_dir="$work_dir/clash-mount"
mkdir -p "$mount_dir" "$work_dir/codex"
cleanup() { hdiutil detach "$mount_dir" >/dev/null 2>&1 || true; }
trap cleanup EXIT
hdiutil attach original-installers/Clash.Verge_2.5.10_x64.dmg -readonly -nobrowse -mountpoint "$mount_dir"
ditto -x -k original-installers/Codex-darwin-x64-26.623.141536.zip "$work_dir/codex"

report='validation/Developer-Signature-Verification.txt'
{
  printf 'Original publisher files. No re-signing or repackaging.\n'
  printf 'Verification host: '; sw_vers -productVersion
  printf 'Architecture: '; uname -m
  printf 'Target computer: Intel macOS Monterey 12.7.6\n'
  printf 'This checks signatures and Gatekeeper on the host above, not a Monterey runtime test.\n\n'
} > "$report"

verify_app() {
  local name="$1" app="$2" executable="$3"
  {
    printf '\n========== %s ==========\n' "$name"
    /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist"
    printf 'Declared minimum macOS: '
    /usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$app/Contents/Info.plist"
    file "$app/Contents/MacOS/$executable"
  } | tee -a "$report"
  codesign --display --verbose=4 "$app" 2>&1 | tee "validation/$name-signature.txt" | tee -a "$report"
  grep -q '^Authority=Developer ID Application:' "validation/$name-signature.txt"
  codesign --verify --deep --strict --verbose=2 "$app" 2>&1 | tee -a "$report"
  spctl --assess --type execute --verbose=4 "$app" 2>&1 | tee -a "$report"
}

verify_app ClashVerge "$mount_dir/Clash Verge.app" clash-verge
verify_app Codex "$work_dir/codex/Codex.app" Codex
cp "$report" original-installers/Developer-Signature-Verification.txt
printf '\nBoth original apps passed Developer ID, code signature and Gatekeeper checks.\n' | tee -a original-installers/Developer-Signature-Verification.txt
