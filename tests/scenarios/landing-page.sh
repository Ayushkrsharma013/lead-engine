# ─── Landing Page Sanity ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
SESS="qa-landing-$$"
PASS=0; FAIL=0; CHECKS=0

green() { printf "\033[32m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
check() { local label="$1"; shift; CHECKS=$((CHECKS+1)); if "$@"; then PASS=$((PASS+1)); echo "  $(green '✓') $label"; else FAIL=$((FAIL+1)); echo "  $(red '✗') $label"; fi; }

echo "  Opening $BASE_URL ..."
agent-browser open "$BASE_URL" --session "$SESS" 2>&1 | head -1
agent-browser wait --load networkidle --session "$SESS" 2>&1 | head -1

# 1. Page loads
check "page loads with 200" \
  test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL")" = "200"

# 2. Navbar elements
check "navbar has Prospecting OS logo" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Prospecting"

# 3. Nav links present
check "nav links present" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "How It Works"

# 4. Hero heading
check "hero heading renders" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Pipeline"

# 5. How It Works section
check "how-it-works has 5 cards" \
  test "$(agent-browser get count '.how-card' --session "$SESS" 2>&1)" -ge 5

# 6. SVG icons, not emoji
check "icons are SVG images, not emoji text" \
  agent-browser snapshot -s ".how-grid" --session "$SESS" 2>&1 | grep -q "image"

# 7. Pricing section
check "pricing has 3 tier cards" \
  test "$(agent-browser get count '.pricing-card' --session "$SESS" 2>&1)" -ge 3

# 8. MOST POPULAR badge
check "MOST POPULAR badge visible" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "MOST POPULAR"

# 9. Testimonials
check "testimonials section has 3 cards" \
  test "$(agent-browser get count '.testimonial-card' --session "$SESS" 2>&1)" -ge 3

# 10. FAQ section
check "FAQ section renders" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Got Questions"

# 11. Chat widget trigger
check "chat trigger button present" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "chat-trigger"

# 12. Chat opens
agent-browser click ".chat-trigger" --session "$SESS" 2>&1 >/dev/null
agent-browser wait 800 --session "$SESS" 2>&1 >/dev/null
check "chat window opens" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Pros Bot"

# 13. Chat quick replies
check "chat has Book a Demo quick reply" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Book a Demo"

# 14. Footer
check "footer with copyright" \
  agent-browser snapshot --session "$SESS" 2>&1 | grep -q "Prospecting OS"

# 15. ASCII canvas present
check "ASCII canvas element in DOM" \
  agent-browser eval "document.querySelector('#asciiCanvas') ? 'exists' : 'missing'" --session "$SESS" 2>&1 | grep -q "exists"

# 16. Landing page wrapper
check "landing-page CSS wrapper applied" \
  agent-browser eval "document.querySelector('.landing-page') ? 'found' : 'missing'" --session "$SESS" 2>&1 | grep -q "found"

agent-browser close --session "$SESS" 2>&1 >/dev/null || true

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
printf "  Landing Page: %d checks | " "$CHECKS"
printf "%s | " "$(green "$PASS passed")"
if [ "$FAIL" -gt 0 ]; then printf "%s\n" "$(red "$FAIL failed")"; else printf "%s\n" "$(green "0 failed")"; fi
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
