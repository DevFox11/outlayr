#!/usr/bin/env bash
set -euo pipefail
channel=${1:-}
case "$channel" in
preview | production) ;;
*)
    echo "usage: decide.sh preview|production" >&2
    exit 2
    ;;
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

build=$(eas build:list --platform ios --channel "$channel" --status finished --distribution store --limit 1 --json --non-interactive |
    field '" ".join((d[0]["id"], d[0]["appBuildVersion"], d[0]["gitCommitHash"], d[0]["runtime"]["version"])) if d else ""')
if [ -z "$build" ]; then
    echo "No store build on channel $channel yet."
    echo
    echo "VERDICT: FIRST BUILD"
    echo "$(run testflight.yml) -F profile=$channel"
    exit 0
fi
read -r build_id build_no build_sha runtime <<<"$build"

base=$build_sha
ota=$(eas update:list --branch "$channel" --runtime-version "$runtime" --platform ios --limit 1 --json --non-interactive |
    field 'd["currentPage"][0]["group"] if d["currentPage"] else ""')
if [ -n "$ota" ]; then
    ota_sha=$(eas update:view "$ota" --json | field 'd[0]["gitCommitHash"]')
    if git merge-base --is-ancestor "$ota_sha" HEAD; then base=$ota_sha; fi
fi

changed=$(git diff --name-only "$base" HEAD)
app=$(grep -E '^(apps/native/|packages/(env|money)/|pnpm-lock\.yaml$)' <<<"$changed" |
    grep -vE '\.test\.tsx?$|__tests__/|\.md$|^apps/native/(\.eas|docs|jest|scripts)/|^apps/native/jest\.config\.js$' || true)
backend=$(grep -E '^packages/backend/convex/' <<<"$changed" | grep -vE '\.test\.ts$' || true)
compare=$(EAS_BUILD_PROFILE=$channel eas fingerprint:compare --build-id "$build_id" --environment "$channel" --non-interactive 2>&1)
fingerprint=$(awk '/matches fingerprint|differs from fingerprint/ { p = 1 } p' <<<"$compare")
if [ -z "$fingerprint" ]; then
    echo "$compare" >&2
    exit 1
fi

echo "Build $build_no on $channel: commit ${build_sha:0:8}, runtime ${runtime:0:8}"
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
    echo "$(run testflight.yml) -F profile=$channel"
else
    echo "VERDICT: OTA"
    echo "$(run update.yml) -F channel=$channel -F message=\$'...'"
fi
