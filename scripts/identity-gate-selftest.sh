#!/usr/bin/env bash
#
# Red dry-run self-test (C3.4).
#
# Proves the negative gate actually catches a planted legacy identifier — i.e.
# it is not vacuously green. The fixture is created ephemerally under apps/ios/
# (non-hidden and non-gitignored so ripgrep scans it) and is ALWAYS removed via
# an EXIT trap; it is never committed.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEG="$REPO_ROOT/scripts/identity-negative-gate.sh"
FIXTURE="$REPO_ROOT/apps/ios/_identity_gate_selftest_fixture.txt"

cleanup() { rm -f "$FIXTURE"; }
trap cleanup EXIT

# 1) Baseline: the gate must be GREEN before we plant anything.
if ! "$NEG" >/dev/null 2>&1; then
  echo "selftest: FAIL — negative gate is already RED before planting a fixture"
  exit 1
fi

# 2) Plant a legacy identifier; the gate MUST go RED.
printf 'group.com.rafaelsoh.dime dimeapp://search\n' > "$FIXTURE"
if "$NEG" >/dev/null 2>&1; then
  echo "selftest: FAIL — gate stayed GREEN with a planted legacy identifier (vacuous gate)"
  exit 1
fi

# 3) Remove the fixture; the gate MUST return to GREEN.
cleanup
if ! "$NEG" >/dev/null 2>&1; then
  echo "selftest: FAIL — gate did not return GREEN after removing the fixture"
  exit 1
fi

echo "selftest: PASS — gate goes RED on a planted identifier and GREEN when clean"
