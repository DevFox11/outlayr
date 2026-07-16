#!/usr/bin/env bash
#
# Identity positive consistency gate (C3.3).
#
# Grep proves only the ABSENCE of old strings; it cannot prove the hand-edited
# non-Swift surfaces hold the correct NEW values. This gate parses
# AppIdentifiers.swift (the single source of truth), applies the derivation
# rules, and asserts exact equality per surface: the 4 entitlements, Info.plist,
# and every pbxproj PRODUCT_BUNDLE_IDENTIFIER. It also self-asserts the expected
# file count so a permissive glob can never silently assert nothing.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS="$REPO_ROOT/apps/ios/app"
SRC="$IOS/Shared/AppIdentifiers.swift"
PB=/usr/libexec/PlistBuddy

# The Apple Developer Team ID is a project constant (not present in
# AppIdentifiers.swift, which uses $(TeamIdentifierPrefix)). Pin it so a
# wrong-but-uniform team flip cannot pass this gate.
EXPECTED_TEAM="8ZB3YXDU7V"

command -v rg >/dev/null 2>&1 || { echo "positive-gate: ERROR — ripgrep (rg) is required"; exit 2; }
[ -x "$PB" ] || { echo "positive-gate: ERROR — PlistBuddy not found"; exit 2; }
[ -f "$SRC" ] || { echo "positive-gate: ERROR — AppIdentifiers.swift not found at $SRC"; exit 2; }

fail=0
ok()  { echo "  ok:   $1"; }
bad() { echo "  FAIL: $1"; fail=1; }

# --- parse the source of truth ---
swift_str() { rg -N -o -r '$1' "static let $1 = \"([^\"]+)\"" "$SRC"; }

bundleIdRoot="$(swift_str bundleIdRoot)"
appGroup="$(swift_str appGroup)"
cloudKitContainer="$(swift_str cloudKitContainer)"
urlScheme="$(swift_str urlScheme)"
ubiquityKVStore="$(swift_str ubiquityKVStore)"
testTargetSuffix="$(swift_str testTargetSuffix)"

extSuffixes=()
while IFS= read -r s; do [ -n "$s" ] && extSuffixes+=("$s"); done < <(
  rg -N 'static let extensionSuffixes' "$SRC" | rg -N -o -r '$1' '"(\.[A-Za-z0-9]+)"'
)

echo "positive-gate: source of truth AppIdentifiers.swift"
echo "  bundleIdRoot=$bundleIdRoot  urlScheme=$urlScheme"
echo "  extSuffixes=${extSuffixes[*]}  testTargetSuffix=$testTargetSuffix"

# --- internal derivation consistency ---
[ "$appGroup" = "group.$bundleIdRoot" ]                     && ok "appGroup == group.+root"        || bad "appGroup ($appGroup) != group.$bundleIdRoot"
[ "$cloudKitContainer" = "iCloud.$bundleIdRoot" ]           && ok "cloudKitContainer == iCloud.+root" || bad "cloudKitContainer ($cloudKitContainer) != iCloud.$bundleIdRoot"
[ "$ubiquityKVStore" = "\$(TeamIdentifierPrefix)$bundleIdRoot" ] && ok "ubiquityKVStore == prefix+root" || bad "ubiquityKVStore ($ubiquityKVStore) != \$(TeamIdentifierPrefix)$bundleIdRoot"

bareScheme="${urlScheme%://}"

# --- entitlements (4 files) ---
ent_files=(
  "$IOS/Outlayr/Outlayr.entitlements"
  "$IOS/ExpenditureWidgetExtension.entitlements"
  "$IOS/BudgetIntent/BudgetIntent.entitlements"
  "$IOS/BudgetIntentUI/BudgetIntentUI.entitlements"
)
for f in "${ent_files[@]}"; do
  if [ ! -f "$f" ]; then bad "missing entitlements file: $f"; continue; fi
  name="$(basename "$f")"
  ag="$($PB -c 'Print :com.apple.security.application-groups:0' "$f" 2>/dev/null || echo '<missing>')"
  ic="$($PB -c 'Print :com.apple.developer.icloud-container-identifiers:0' "$f" 2>/dev/null || echo '<missing>')"
  kv="$($PB -c 'Print :com.apple.developer.ubiquity-kvstore-identifier' "$f" 2>/dev/null || echo '<missing>')"
  [ "$ag" = "$appGroup" ]          && ok "$name app-group"        || bad "$name app-group ($ag)"
  [ "$ic" = "$cloudKitContainer" ] && ok "$name icloud-container" || bad "$name icloud-container ($ic)"
  [ "$kv" = "$ubiquityKVStore" ]   && ok "$name ubiquity-kvstore" || bad "$name ubiquity-kvstore ($kv)"
done

# --- Info.plist ---
plist="$IOS/Outlayr/Info.plist"
if [ ! -f "$plist" ]; then
  bad "missing Info.plist: $plist"
else
  urlName="$($PB -c 'Print :CFBundleURLTypes:0:CFBundleURLName' "$plist" 2>/dev/null || echo '<missing>')"
  scheme0="$($PB -c 'Print :CFBundleURLTypes:0:CFBundleURLSchemes:0' "$plist" 2>/dev/null || echo '<missing>')"
  sc0="$($PB -c 'Print :UIApplicationShortcutItems:0:UIApplicationShortcutItemType' "$plist" 2>/dev/null || echo '<missing>')"
  sc1="$($PB -c 'Print :UIApplicationShortcutItems:1:UIApplicationShortcutItemType' "$plist" 2>/dev/null || echo '<missing>')"
  [ "$urlName" = "$bundleIdRoot" ]         && ok "Info CFBundleURLName"     || bad "Info CFBundleURLName ($urlName)"
  [ "$scheme0" = "$bareScheme" ]           && ok "Info bare url scheme"     || bad "Info bare url scheme ($scheme0)"
  [ "$sc0" = "${urlScheme}search" ]        && ok "Info shortcut search"     || bad "Info shortcut search ($sc0)"
  [ "$sc1" = "${urlScheme}newExpense" ]    && ok "Info shortcut newExpense" || bad "Info shortcut newExpense ($sc1)"
fi

# --- pbxproj PRODUCT_BUNDLE_IDENTIFIER lines ---
pbx="$IOS/Outlayr.xcodeproj/project.pbxproj"
if [ ! -f "$pbx" ]; then
  bad "missing pbxproj: $pbx"
else
  allowed=("$bundleIdRoot" "$bundleIdRoot$testTargetSuffix")
  for s in "${extSuffixes[@]}"; do allowed+=("$bundleIdRoot$s"); done

  count=0
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    count=$((count + 1))
    match=0
    for a in "${allowed[@]}"; do [ "$id" = "$a" ] && match=1 && break; done
    [ "$match" = 1 ] && ok "pbxproj bundle id: $id" || bad "pbxproj unexpected bundle id: $id"
  done < <(rg -N -o -r '$1' 'PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);' "$pbx")

  # Expected count derived from the native-target inventory:
  # (app + widget + BudgetIntent + BudgetIntentUI + OutlayrTests) x (Debug + Release) = 10
  expected_pbx=10
  [ "$count" = "$expected_pbx" ] && ok "pbxproj bundle-id line count = $count" || bad "pbxproj bundle-id count $count != $expected_pbx"

  # DEVELOPMENT_TEAM must be uniform AND equal to the expected team — a
  # wrong-but-uniform team flip breaks entitlement/CloudKit binding on-device.
  uteams=()
  while IFS= read -r t; do [ -n "$t" ] && uteams+=("$t"); done < <(
    rg -N -o -r '$1' 'DEVELOPMENT_TEAM = ([^;]+);' "$pbx" | sort -u
  )
  if [ "${#uteams[@]}" -eq 1 ] && [ "${uteams[0]:-}" = "$EXPECTED_TEAM" ]; then
    ok "DEVELOPMENT_TEAM uniform == $EXPECTED_TEAM"
  else
    bad "DEVELOPMENT_TEAM must be uniform $EXPECTED_TEAM (got: ${uteams[*]:-none})"
  fi
fi

# --- file-count self-assertion (never silently assert nothing) ---
expected_files=6
found=0
for f in "${ent_files[@]}" "$plist" "$pbx"; do [ -f "$f" ] && found=$((found + 1)); done
[ "$found" = "$expected_files" ] && ok "located $found/$expected_files surface files" || bad "located $found/$expected_files surface files"

if [ "$fail" = 0 ]; then
  echo "positive-gate: PASS"
  exit 0
fi
echo "positive-gate: FAIL"
exit 1
