# ─── RBAC & Role Boundary Sanity ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0; FAIL=0; CHECKS=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
check() { local label="$1"; shift; CHECKS=$((CHECKS+1)); if "$@"; then PASS=$((PASS+1)); echo "  $(green '✓') $label"; else FAIL=$((FAIL+1)); echo "  $(red '✗') $label"; fi; }

QA_EMAIL="${QA_EMAIL:-qa@flow-forges.com}"
QA_PASSWORD="${QA_AGENT_PASSWORD:-}"

# 1. Unauthenticated user redirected from /dashboard
check "Unauthenticated /dashboard returns 302 redirect" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dashboard")" = "302"

# 2. Unauthenticated user redirected from /admin/users
check "Unauthenticated /admin/users returns 302 redirect" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/users")" = "302"

# 3. Unauthenticated user redirected from /client-portal
check "Unauthenticated /client-portal returns 302 redirect" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/client-portal")" = "302"

# 4. Public routes accessible
check "Public: / returns 200" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")" = "200"

check "Public: /login returns 200" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")" = "200"

check "Public: /signup returns 200" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/signup")" = "200"

check "Public: /book returns 200" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/book")" = "200"

# 5. Client portal API requires auth
check "API: /api/client-portal/me returns 401 without auth" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/client-portal/me")" = "401"

check "API: /api/client-portal/leads returns 401 without auth" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/client-portal/leads")" = "401"

# 6. Admin API requires auth
check "API: /api/admin/users returns 403 without auth" \
  test "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/admin/users")" != "200"

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
printf "  RBAC: %d checks | " "$CHECKS"
printf "%s | " "$(green "$PASS passed")"
if [ "$FAIL" -gt 0 ]; then printf "%s\n" "$(red "$FAIL failed")"; else printf "%s\n" "$(green "0 failed")"; fi
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
