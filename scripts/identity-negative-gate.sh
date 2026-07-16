#!/usr/bin/env bash
#
# Identity negative gate (C3.2).
#
# Fails if any legacy Dime identifier survives under apps/ios/ — the flipped
# identity strings AND the old Apple Developer team id. Bare `dime` and the
# `.dimeTests` suffix are the scheme/module/project rename handled by C4 and are
# intentionally NOT matched here — only the values flipped in C3.
#
# Scope: apps/ios/ (design #743's repo-wide intent is served locally by this
# tree being the only place the patterns live; CI is disabled for billing).
# Allow-list (design #743): the gate's own scripts and the two history docs that
# must describe the old identity. Those live outside apps/ios/, so the apps/ios/
# scan already excludes them; the globs keep the gate correct if scope widens.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_DIR="${1:-$REPO_ROOT/apps/ios}"

command -v rg >/dev/null 2>&1 || { echo "negative-gate: ERROR — ripgrep (rg) is required"; exit 2; }

# Case-sensitive so `dimeApp` (capital A: the file/type rename deferred to C4)
# does not trip the gate. C4 tightens this to case-insensitive. The trailing
# token is the old Apple Developer team id, flipped to 8ZB3YXDU7V in C3.
PATTERN='com\.rafaelsoh\.dime|rafaelsoh|dimeapp|5UNNTHMF44'

ALLOW=(
  '!scripts/**'                         # the gate's own scripts (self-match)
  '!docs/decisions/baseline.md'         # baseline history (describes old ids)
  '!docs/decisions/rebrand-identity.md' # this flip's old->new map
)
globs=()
for g in "${ALLOW[@]}"; do globs+=(--glob "$g"); done

echo "negative-gate: scanning '$SCAN_DIR' (case-sensitive) for legacy identifiers"

set +e
matches="$(rg --case-sensitive -n "${globs[@]}" "$PATTERN" "$SCAN_DIR")"
rc=$?
set -e

case "$rc" in
  0)
    echo "$matches"
    echo "negative-gate: FAIL — legacy identifier(s) found above"
    exit 1
    ;;
  1)
    echo "negative-gate: PASS — no legacy identifiers"
    exit 0
    ;;
  *)
    echo "negative-gate: ERROR — rg exited $rc"
    exit 2
    ;;
esac
