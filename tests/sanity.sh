#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# QA_Bot — Full Sanity Suite for Prospecting OS
# Usage: BASE_URL=http://localhost:3000 bash tests/sanity.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"

PASS=0
FAIL=0
CHECKS=0

green()  { printf "\033[32m%s\033[0m" "$1"; }
red()    { printf "\033[31m%s\033[0m" "$1"; }
bold()   { printf "\033[1m%s\033[0m" "$1"; }
dim()    { printf "\033[2m%s\033[0m" "$1"; }

check() {
  local label="$1"; shift
  CHECKS=$((CHECKS + 1))
  if "$@"; then
    PASS=$((PASS + 1))
    echo "  $(green '✓') $label"
  else
    FAIL=$((FAIL + 1))
    echo "  $(red '✗') $label"
  fi
}

echo ""
echo "  $(bold 'QA_Bot') — Prospecting OS Sanity Suite"
echo "  Target: $(dim "$BASE_URL")"
echo "  Started: $(dim "$(date)")"
echo ""

# ─── Run scenarios ──────────────────────────────────────────────────────────
for scenario in "$SCRIPT_DIR"/scenarios/*.sh; do
  name="$(basename "$scenario" .sh)"
  echo "  $(bold "${name}")"
  # shellcheck source=/dev/null
  source "$scenario"
  echo ""
done

# ─── Summary ────────────────────────────────────────────────────────────────
echo "  ═══════════════════════════════════"
printf "  Total: %d  |  " "$CHECKS"
printf "%s  |  " "$(green "$PASS passed")"
if [ "$FAIL" -gt 0 ]; then
  printf "%s\n" "$(red "$FAIL failed")"
else
  printf "%s\n" "$(green "0 failed")"
fi
echo "  ═══════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
