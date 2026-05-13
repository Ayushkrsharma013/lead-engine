# ─── API Endpoint Sanity ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0; FAIL=0; CHECKS=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
check() { local label="$1"; shift; CHECKS=$((CHECKS+1)); if "$@"; then PASS=$((PASS+1)); echo "  $(green '✓') $label"; else FAIL=$((FAIL+1)); echo "  $(red '✗') $label"; fi; }

# 1. GET /api/appointments
check "GET /api/appointments returns 200" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/appointments")" = "200"

# 2. GET /api/appointments returns array
check "GET /api/appointments returns JSON array" \
  curl -s "$BASE_URL/api/appointments" | grep -q '^\['

# 3. POST /api/appointments creates booking
check "POST /api/appointments creates booking" \
  curl -s -X POST "$BASE_URL/api/appointments" \
    -H "Content-Type: application/json" \
    -d '{"date":"2026-06-01","time":"14:00","name":"QA Test","email":"qa@test.com","company":"TestCorp"}' | grep -q '"ok":true'

# 4. POST /api/leads/capture
check "POST /api/leads/capture returns ok" \
  curl -s -X POST "$BASE_URL/api/leads/capture" \
    -H "Content-Type: application/json" \
    -d '{"email":"qa-capture@test.com"}' | grep -q '"ok":true'

# 5. POST /api/appointments validates email
check "POST /api/appointments rejects invalid email" \
  curl -s -X POST "$BASE_URL/api/appointments" \
    -H "Content-Type: application/json" \
    -d '{"date":"x","time":"x","name":"x","email":"not-an-email"}' | grep -q "400\|Invalid"

# 6. POST /api/appointments requires fields
check "POST /api/appointments rejects missing fields" \
  test "$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/appointments" \
    -H "Content-Type: application/json" \
    -d '{}')" = "400"

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
printf "  API: %d checks | " "$CHECKS"
printf "%s | " "$(green "$PASS passed")"
if [ "$FAIL" -gt 0 ]; then printf "%s\n" "$(red "$FAIL failed")"; else printf "%s\n" "$(green "0 failed")"; fi
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
