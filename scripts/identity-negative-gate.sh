#!/usr/bin/env bash
#
# Identity negative gate (C3.2, tightened in C4.3).
#
# Fails if any legacy Dime identifier survives under apps/ios/ — the flipped
# identity strings, the old Apple Developer team id, AND the pre-rename
# project/target/scheme/module names removed in C4.
#
# C4 renamed the `dime` project/target/scheme/module (and the `dimeApp`,
# `DimeWidgets`, `DimeShortcuts` types and the `dimeTests` target) to `Outlayr`,
# so the C3 case-sensitivity carve-out — which existed only to keep the capital-A
# `dimeApp` struct/file from tripping the `dimeapp` pattern — is no longer needed.
# The scan is now CASE-INSENSITIVE so case-variant reintroductions (`DimeApp`,
# `dimeApp://`, `com.rafaelsoh.Dime`, `DimeTests`, …) cannot pass silently.
#
# Scope: apps/ios/ (design #743's repo-wide intent is served locally by this
# tree being the only place the patterns live; CI is disabled for billing).
#
# NOT a brand-name "Dime" scanner: user-facing "Dime" product copy (Localizable
# strings, app-icon subtitles, the `dime_name` key, the `Follow Dime` / support
# links) is still present until the C5 copy swap and is enforced by the separate
# branding gate (spec C8) with its own attribution exemptions. A bare `dime`
# match would also collide with unrelated identifiers such as `ViewDimensions`.
#
# Allow-list (design #743): the gate's own scripts, the two history docs that
# must describe the old identity, and `apps/ios/README.md` (whose mandated GPL
# attribution links to the upstream `rafsoh/dimeApp` repo).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_DIR="${1:-$REPO_ROOT/apps/ios}"

command -v rg >/dev/null 2>&1 || { echo "negative-gate: ERROR — ripgrep (rg) is required"; exit 2; }

# Legacy identity strings plus the pre-C4 structural names (matched
# case-insensitively). The trailing team token is the old Apple Developer team
# id, flipped to 8ZB3YXDU7V in C3.
PATTERN='com\.rafaelsoh\.dime|rafaelsoh|dimeapp|5UNNTHMF44|dimetests|dimewidgets|dimeshortcuts'

ALLOW=(
  '!scripts/**'                         # the gate's own scripts (self-match)
  '!README.md'                          # apps/ios/README.md (GPL attribution link)
  '!apps/ios/README.md'                 # same, if scope widens to repo root
  '!docs/decisions/baseline.md'         # baseline history (describes old ids)
  '!docs/decisions/rebrand-identity.md' # this flip's old->new map
)
globs=()
for g in "${ALLOW[@]}"; do globs+=(--glob "$g"); done

echo "negative-gate: scanning '$SCAN_DIR' (case-insensitive) for legacy identifiers"

set +e
matches="$(rg --ignore-case -n "${globs[@]}" "$PATTERN" "$SCAN_DIR")"
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
