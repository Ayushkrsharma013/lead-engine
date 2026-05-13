# ─── Dashboard Sanity ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
SESS="qa-dash-$$"
PASS=0; FAIL=0; CHECKS=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
check() { local label="$1"; shift; CHECKS=$((CHECKS+1)); if "$@"; then PASS=$((PASS+1)); echo "  $(green '✓') $label"; else FAIL=$((FAIL+1)); echo "  $(red '✗') $label"; fi; }

echo "  Opening $BASE_URL/dashboard ..."
agent-browser open "$BASE_URL/dashboard" --session "$SESS" 2>&1 | head -1
agent-browser wait --load networkidle --session "$SESS" 2>&1 | head -1

# 1. Page loads
check "dashboard loads (200)" \
  test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/dashboard")" = "200"

# 2. TopBar
check "TopBar shows Command Center" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Command Center"

# 3. Stat cards
check "Demos Booked stat card visible" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Demos Booked"

# 4. Demo Bookings table
check "Demo Bookings panel renders" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Demo Bookings"

# 5. Activity feed
check "Recent Activity section present" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Recent Activity"

# 6. Campaigns section
check "Campaigns section present" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Campaigns"

# 7. Quick Actions bar
check "Quick Actions bar visible" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Quick Actions"

agent-browser close --session "$SESS" 2>&1 >/dev/null || true

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
printf "  Dashboard: %d checks | " "$CHECKS"
printf "%s | " "$(green "$PASS passed")"
if [ "$FAIL" -gt 0 ]; then printf "%s\n" "$(red "$FAIL failed")"; else printf "%s\n" "$(green "0 failed")"; fi
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
