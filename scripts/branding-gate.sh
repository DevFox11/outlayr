#!/usr/bin/env bash
#
# Branding gate (C5.4).
#
# Enforces that no user-facing Dime *product* branding survives after the C5
# copy swap, while PRESERVING the GPL attribution the license REQUIRES us to keep
# (Rafael Soh, the upstream rafsoh/dimeApp repo, the in-app "Based on Dime by
# Rafael Soh" credit). It is deliberately EXACT-SURFACE (spec C8 / design D5),
# NOT a blind repo-wide `Dime` grep — a bare grep would collide with the
# mandated attribution and with unrelated identifiers (e.g. `ViewDimensions`).
#
# Two scans:
#   A. Dime-specific identifiers that must never ship under the Outlayr product:
#        id1635280255    Dime's App Store listing (rate / share links)
#        budgetwithdime  Dime's X handle
#        rafasohhh       Dime author's support / contact email
#      Guarded EVERYWHERE under the scan dir (only the gate's own script may
#      contain them — it necessarily names the patterns it scans for).
#   B. The bare product name `Dime` in user-facing copy (Swift string literals,
#      Localizable.strings, pbxproj display name), case-sensitive so it targets
#      the capitalised brand word. EXEMPTS the attribution surfaces: LICENSE,
#      README acknowledgements, the in-app credits screen, and the inherited
#      privacy-policy doc (flagged for a proper Outlayr rewrite), plus the gate.
#
# Complements the identity gates (which cover machine identifiers). This gate
# covers user-facing brand COPY, which those gates intentionally leave alone.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_DIR="${1:-$REPO_ROOT/apps/ios}"

command -v rg >/dev/null 2>&1 || { echo "branding-gate: ERROR — ripgrep (rg) is required"; exit 2; }

fail=0

# --- A. Dime-specific identifiers ---
ID_PATTERN='id1635280255|budgetwithdime|rafasohhh'
ID_ALLOW=( '!scripts/**' ) # self-match: the gate names the patterns it scans for
idglobs=(); for g in "${ID_ALLOW[@]}"; do idglobs+=(--glob "$g"); done

echo "branding-gate: [A] scanning '$SCAN_DIR' for Dime identifiers (App Store id / X handle / support email)"
set +e
id_hits="$(rg -n -s "${idglobs[@]}" "$ID_PATTERN" "$SCAN_DIR")"
id_rc=$?
set -e
case "$id_rc" in
  0) echo "$id_hits"; echo "branding-gate: FAIL [A] — Dime identifier(s) found above"; fail=1 ;;
  1) echo "  ok: no Dime identifiers" ;;
  *) echo "branding-gate: ERROR — rg exited $id_rc (scan A)"; exit 2 ;;
esac

# --- B. Bare product name "Dime" in user-facing copy (attribution exempted) ---
NAME_PATTERN='\bDime\b'
NAME_ALLOW=(
  '!scripts/**'               # the gate's own script (self-match)
  '!README.md'                # GPL acknowledgements ("based on Dime by Rafael Soh")
  '!LICENSE'                  # license text
  '!SettingsAboutView.swift'  # in-app GPL credits ("Based on Dime by Rafael Soh")
  '!privacypolicy.md'         # inherited legal doc (flagged for an Outlayr rewrite)
)
nameglobs=(); for g in "${NAME_ALLOW[@]}"; do nameglobs+=(--glob "$g"); done

echo "branding-gate: [B] scanning '$SCAN_DIR' for bare product name 'Dime' in user-facing copy"
set +e
name_hits="$(rg -n -s "${nameglobs[@]}" "$NAME_PATTERN" "$SCAN_DIR")"
name_rc=$?
set -e
case "$name_rc" in
  0) echo "$name_hits"; echo "branding-gate: FAIL [B] — bare 'Dime' product copy above (swap to Outlayr, or allow-list if it is mandated attribution)"; fail=1 ;;
  1) echo "  ok: no bare 'Dime' product copy" ;;
  *) echo "branding-gate: ERROR — rg exited $name_rc (scan B)"; exit 2 ;;
esac

if [ "$fail" = 0 ]; then
  echo "branding-gate: PASS — no Dime product branding outside mandated attribution"
  exit 0
fi
echo "branding-gate: FAIL"
exit 1
