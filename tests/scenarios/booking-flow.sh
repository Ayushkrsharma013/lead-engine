# ─── Booking Flow Sanity ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
SESS="qa-book-$$"
PASS=0; FAIL=0; CHECKS=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
check() { local label="$1"; shift; CHECKS=$((CHECKS+1)); if "$@"; then PASS=$((PASS+1)); echo "  $(green '✓') $label"; else FAIL=$((FAIL+1)); echo "  $(red '✗') $label"; fi; }

echo "  Opening $BASE_URL/book ..."
agent-browser open "$BASE_URL/book" --session "$SESS" 2>&1 | head -1
agent-browser wait --load networkidle --session "$SESS" 2>&1 | head -1

# 1. Page loads
check "/book page loads" \
  test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/book")" = "200"

# 2. Page renders
check "booking heading visible" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Schedule Your Demo"

# 3. Calendar with future dates
check "calendar has clickable future dates" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -E -q 'button "[1-3][0-9]"'

# 4. Past dates disabled
check "past dates are disabled" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "disabled"

# 5. Progress steps
check "progress steps 1→2→3 visible" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Date" && \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Time"

# 6. Pros Bot panel
check "Pros Bot panel rendered" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Pros Bot"

# 7. Select a date
agent-browser eval "var btns=document.querySelectorAll('button'); for(var i=0;i<btns.length;i++){var t=btns[i].textContent.trim(); if(/^[12][0-9]\$/.test(t) && !btns[i].disabled){btns[i].click(); break;}}" --session "$SESS" 2>&1 >/dev/null
agent-browser wait 500 --session "$SESS" 2>&1 >/dev/null
check "date selection enables continue button" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Continue"

# 8. Advance to step 2
agent-browser eval "var btns=document.querySelectorAll('button'); for(var i=0;i<btns.length;i++){if(btns[i].textContent.includes('Continue')){btns[i].click();break;}}" --session "$SESS" 2>&1 >/dev/null
agent-browser wait 500 --session "$SESS" 2>&1 >/dev/null
check "time slots shown (09:00 present)" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "09:00"

agent-browser close --session "$SESS" 2>&1 >/dev/null || true

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
printf "  Booking Flow: %d checks | " "$CHECKS"
printf "%s | " "$(green "$PASS passed")"
if [ "$FAIL" -gt 0 ]; then printf "%s\n" "$(red "$FAIL failed")"; else printf "%s\n" "$(green "0 failed")"; fi
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
