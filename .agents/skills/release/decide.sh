#!/usr/bin/env bash
set -euo pipefail
channel=${1:-}
platform=${2:-ios}
usage() {
    echo "usage: decide.sh preview|production [ios|android]" >&2
    exit 2
}
case "$channel" in
preview | production) ;;
*) usage ;;
esac
# `foreign` matches paths only the other platform's binary is built from.
case "$platform" in
ios)
    ship=testflight.yml
    foreign='\.android\.[jt]sx?$|^apps/native/modules/[^/]+/android/'
    ;;
android)
    ship=play.yml
    foreign='^apps/native/(app-intents|targets|modules/[^/]+/ios)/'
    ;;
*) usage ;;
esac
cd "$(git rev-parse --show-toplevel)/apps/native"
export npm_config_loglevel=error

eas() { npx -y eas-cli "$@"; }
field() { python3 -c "import json,sys; d=json.loads(sys.stdin.read(),strict=False); print($1)"; }
run() { echo "npx eas-cli workflow:run .eas/workflows/$1 --non-interactive --wait"; }

git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] || [ -n "$(git status --porcelain)" ]; then
    echo "The fingerprint hashes this checkout. Put it on a clean origin/main first:" >&2
    echo "  git switch --detach origin/main && vp i" >&2
    exit 1
fi

# @expo/fingerprint 0.21.4 drops every Expo module from the Android fingerprint
# when one Gradle plugin has no source folder (expo-widgets' does not), so a
# native-only change would read as an OTA. patches/@expo__fingerprint@*.patch
# fixes it; this catches a bump that loses the patch.
if [ "$platform" = android ]; then
    modules=$(EAS_BUILD_PROFILE=$channel npx expo-updates fingerprint:generate --platform android |
        field 'sum("expoAutolinkingAndroid" in s.get("reasons", []) for s in d["sources"])')
    if [ "$modules" = 0 ]; then
        echo "The Android fingerprint lists no Expo module sources, so it can't see native changes." >&2
        echo "Check that the @expo/fingerprint patch in pnpm-workspace.yaml still applies." >&2
        exit 1
    fi
fi

build=$(eas build:list --platform "$platform" --channel "$channel" --status finished --distribution store --limit 1 --json --non-interactive |
    field '" ".join((d[0]["id"], d[0]["appBuildVersion"], d[0]["gitCommitHash"], d[0]["runtime"]["version"])) if d else ""')
if [ -z "$build" ]; then
    echo "No $platform store build on channel $channel yet."
    echo
    echo "VERDICT: FIRST BUILD"
    echo "$(run "$ship") -F profile=$channel"
    exit 0
fi
read -r build_id build_no build_sha runtime <<<"$build"

base=$build_sha
ota=$(eas update:list --branch "$channel" --runtime-version "$runtime" --platform "$platform" --limit 1 --json --non-interactive |
    field 'd["currentPage"][0]["group"] if d["currentPage"] else ""')
if [ -n "$ota" ]; then
    ota_sha=$(eas update:view "$ota" --json | field 'd[0]["gitCommitHash"]')
    if git merge-base --is-ancestor "$ota_sha" HEAD; then base=$ota_sha; fi
fi

changed=$(git diff --name-only "$base" HEAD)
app=$(grep -E '^(apps/native/|packages/(env|money)/|pnpm-lock\.yaml$)' <<<"$changed" |
    grep -vE '\.test\.tsx?$|__tests__/|\.md$|^apps/native/(\.eas|docs|jest|scripts)/|^apps/native/jest\.config\.js$' |
    grep -vE "$foreign" || true)
backend=$(grep -E '^packages/backend/convex/' <<<"$changed" | grep -vE '\.test\.ts$' || true)
compare=$(EAS_BUILD_PROFILE=$channel eas fingerprint:compare --build-id "$build_id" --environment "$channel" --non-interactive 2>&1)
fingerprint=$(awk '/matches fingerprint|differs from fingerprint/ { p = 1 } p' <<<"$compare")
if [ -z "$fingerprint" ]; then
    echo "$compare" >&2
    exit 1
fi

echo "$platform build $build_no on $channel: commit ${build_sha:0:8}, runtime ${runtime:0:8}"
echo "Last OTA on that runtime: ${ota:-none}${ota_sha:+ at ${ota_sha:0:8}}"
echo
echo "Merged since ${base:0:8}:"
git log --oneline --no-merges "$base..HEAD"
echo
echo "App files:"
echo "${app:-  none}"
echo "Backend files:"
echo "${backend:-  none}"
echo
echo "$fingerprint"
echo

if [ -z "$app" ] && [ -z "$backend" ]; then
    echo "VERDICT: NOTHING TO SHIP"
elif [ -z "$app" ]; then
    echo "VERDICT: BACKEND ONLY"
    echo "$(run deploy-backend.yml) -F environment=$channel"
elif grep -q 'differs from fingerprint' <<<"$fingerprint"; then
    echo "VERDICT: BUILD"
    echo "$(run "$ship") -F profile=$channel"
else
    echo "VERDICT: OTA"
    echo "$(run update.yml) -F channel=$channel -F platform=$platform -F message=\$'...'"
fi
