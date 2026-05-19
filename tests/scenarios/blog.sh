#!/usr/bin/env bash
# =============================================================================
# Blog Sanity Test Suite — Prospecting OS
# =============================================================================
# Run: bash tests/scenarios/blog.sh
# Requires: curl, grep
# Base URL override: BLOG_BASE_URL=https://my-deploy.vercel.app bash tests/scenarios/blog.sh

set -euo pipefail

BASE="${BLOG_BASE_URL:-https://app.flow-forges.com}"
BLOG_LIST="${BASE}/prospecting-os/blog"
BLOG_API="${BASE}/prospecting-os/api/blog"
PASS=0
FAIL=0

green() { printf '\033[0;32m✓\033[0m %s\n' "$*"; PASS=$((PASS + 1)); }
red()   { printf '\033[0;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL + 1)); }

echo "════════════════════════════════════════════════════════════"
echo "  Blog Sanity Suite — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Target: ${BASE}"
echo "════════════════════════════════════════════════════════════"
echo ""

# ─── 1. Blog List Page ──────────────────────────────────────────────────────
echo "── Blog List Page ──"

# 1a. HTTP 200
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' "${BLOG_LIST}")
if [ "$HTTP" = "200" ]; then
  green "GET /blog → 200 OK"
else
  red "GET /blog → ${HTTP} (expected 200)"
fi

# 1b. Title tag
TITLE=$(curl -sS "${BLOG_LIST}" | grep -oP '<title>[^<]+</title>' | head -1)
if echo "$TITLE" | grep -qi "Prospecting"; then
  green "Page <title> contains 'Prospecting': ${TITLE}"
else
  red "Page <title> missing 'Prospecting': ${TITLE}"
fi

# 1c. H1 heading
H1=$(curl -sS "${BLOG_LIST}" | grep -oP '<h1[^>]*>[^<]+</h1>' | head -1)
if echo "$H1" | grep -qi "B2B Lead Generation"; then
  green "H1: '${H1}'"
else
  red "H1 missing 'B2B Lead Generation': ${H1}"
fi

# 1d. Navbar logo present
if curl -sS "${BLOG_LIST}" | grep -q "Prospecting OS"; then
  green "Navbar: 'Prospecting OS' logo text found"
else
  red "Navbar: 'Prospecting OS' logo text missing"
fi

# 1e. Nav links present
if curl -sS "${BLOG_LIST}" | grep -q "How It Works"; then
  green "Navbar: 'How It Works' link found"
else
  red "Navbar: 'How It Works' link missing"
fi

# 1f. Blog link active
if curl -sS "${BLOG_LIST}" | grep -q "/blog"; then
  green "Navbar: Blog link found"
else
  red "Navbar: Blog link missing"
fi

# 1g. Category pills present
if curl -sS "${BLOG_LIST}" | grep -q "Lead Gen"; then
  green "Category pills: 'Lead Gen' found"
else
  red "Category pills: 'Lead Gen' missing"
fi

# 1h. Theme toggle present
if curl -sS "${BLOG_LIST}" | grep -q "Toggle light/dark theme"; then
  green "Theme toggle button found"
else
  red "Theme toggle button missing"
fi

# 1i. Footer present
if curl -sS "${BLOG_LIST}" | grep -q "Prospecting OS footer"; then
  green "Footer: 'Prospecting OS footer' found"
else
  red "Footer: 'Prospecting OS footer' missing"
fi

# 1j. Footer copyright
if curl -sS "${BLOG_LIST}" | grep -q "2026.*Flow-Forges"; then
  green "Footer: copyright '2026 Flow-Forges' found"
else
  red "Footer: copyright missing"
fi

echo ""

# ─── 2. Blog Post Page ───────────────────────────────────────────────────────
echo "── Blog Post Page ──"

POST_SLUG="cold-email-sequences-that-convert-in-2026"
POST_URL="${BASE}/prospecting-os/blog/${POST_SLUG}"

# 2a. HTTP 200
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' "${POST_URL}")
if [ "$HTTP" = "200" ]; then
  green "GET /blog/${POST_SLUG} → 200 OK"
else
  red "GET /blog/${POST_SLUG} → ${HTTP} (expected 200)"
fi

# 2b. Title tag
TITLE=$(curl -sS "${POST_URL}" | grep -oP '<title>[^<]+</title>' | head -1)
if echo "$TITLE" | grep -qi "Prospecting OS Blog"; then
  green "Page <title> contains 'Prospecting OS Blog': ${TITLE}"
else
  red "Page <title> missing 'Prospecting OS Blog': ${TITLE}"
fi

# 2c. Post heading (h1)
H1=$(curl -sS "${POST_URL}" | grep -oP '<h1[^>]*>[^<]+</h1>' | head -1)
if echo "$H1" | grep -q "Cold Email"; then
  green "H1: '${H1}'"
else
  red "H1 missing expected title: ${H1}"
fi

# 2d. Category badge
if curl -sS "${POST_URL}" | grep -q "lead-gen"; then
  green "Category badge found"
else
  red "Category badge missing"
fi

# 2e. Read time
if curl -sS "${POST_URL}" | grep -q "min read"; then
  green "Read time marker found"
else
  red "Read time marker missing"
fi

# 2f. Content rendering (headings from markdown)
if curl -sS "${POST_URL}" | grep -q "The problem with most cold emails"; then
  green "Content: markdown h2 rendered"
else
  red "Content: markdown h2 missing"
fi

# 2g. Strong/bold text
if curl -sS "${POST_URL}" | grep -qiP '<strong[^>]*>'; then
  green "Content: <strong> tags rendered"
else
  red "Content: <strong> tags missing"
fi

# 2h. Bottom CTA
if curl -sS "${POST_URL}" | grep -q "Ready to fill your pipeline"; then
  green "Bottom CTA: 'Ready to fill your pipeline?' found"
else
  red "Bottom CTA missing"
fi

# 2i. Back link
if curl -sS "${POST_URL}" | grep -q "All Posts"; then
  green "Navigation: '← All Posts' back link found"
else
  red "Navigation: '← All Posts' back link missing"
fi

# 2j. Footer on post page
if curl -sS "${POST_URL}" | grep -q "Prospecting OS footer"; then
  green "Footer present on post page"
else
  red "Footer missing on post page"
fi

echo ""

# ─── 3. Blog API ────────────────────────────────────────────────────────────
echo "── Blog API ──"

# 3a. GET /api/blog → 200
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' "${BLOG_API}")
if [ "$HTTP" = "200" ]; then
  green "GET /api/blog → 200 OK"
else
  red "GET /api/blog → ${HTTP} (expected 200)"
fi

# 3b. Returns posts array
if curl -sS "${BLOG_API}" | grep -q '"posts"'; then
  green "Response contains 'posts' key"
else
  red "Response missing 'posts' key"
fi

# 3c. Posts are non-empty
POST_COUNT=$(curl -sS "${BLOG_API}" | grep -oP '"slug"' | wc -l)
if [ "$POST_COUNT" -ge 1 ]; then
  green "Posts count: ${POST_COUNT} (>= 1)"
else
  red "Posts count: ${POST_COUNT} (expected >= 1)"
fi

# 3d. Each post has required fields
for field in slug title excerpt content category read_time status published_at; do
  if curl -sS "${BLOG_API}" | grep -q "\"${field}\""; then
    green "  Post field '${field}' present"
  else
    red "  Post field '${field}' missing"
  fi
done

# 3e. API with category filter
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' "${BLOG_API}?category=lead-gen")
if [ "$HTTP" = "200" ]; then
  green "GET /api/blog?category=lead-gen → 200 OK"
else
  red "GET /api/blog?category=lead-gen → ${HTTP} (expected 200)"
fi

# 3f. API single post
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' "${BLOG_API}/${POST_SLUG}")
if [ "$HTTP" = "200" ]; then
  green "GET /api/blog/${POST_SLUG} → 200 OK"
else
  red "GET /api/blog/${POST_SLUG} → ${HTTP} (expected 200)"
fi

# 3g. API 404 for nonexistent post
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' "${BLOG_API}/nonexistent-post-xyz")
if [ "$HTTP" = "404" ]; then
  green "GET /api/blog/nonexistent → 404 (correct)"
else
  red "GET /api/blog/nonexistent → ${HTTP} (expected 404)"
fi

echo ""

# ─── 4. No Admin Chrome on Blog Pages ────────────────────────────────────────
echo "── No Admin Chrome ──"

# 4a. Sidebar should NOT be present
if ! curl -sS "${BLOG_LIST}" | grep -q "Command Center\|Lead Intelligence\|AI Studio"; then
  green "No admin sidebar on blog list page"
else
  red "Admin sidebar detected on blog list page!"
fi

# 4b. Sidebar should NOT be present on post page
if ! curl -sS "${POST_URL}" | grep -q "Command Center\|Lead Intelligence\|AI Studio"; then
  green "No admin sidebar on blog post page"
else
  red "Admin sidebar detected on blog post page!"
fi

echo ""

# ─── 5. Blog Landing Page Alignment ─────────────────────────────────────────
echo "── Landing Page Alignment ──"

# 5a. landing-page CSS class present
if curl -sS "${BLOG_LIST}" | grep -q 'landing-page'; then
  green "'.landing-page' CSS scope class present"
else
  red "'.landing-page' CSS scope class missing"
fi

# 5b. CSS variables from landing.css
if curl -sS "${BLOG_LIST}" | grep -q 'var(--bg-primary)'; then
  green "CSS variable --bg-primary referenced"
else
  red "CSS variable --bg-primary not found"
fi

# 5c. Accent color (#e8420a)
if curl -sS "${BLOG_LIST}" | grep -q 'var(--accent)'; then
  green "CSS variable --accent referenced"
else
  red "CSS variable --accent not found"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
printf "  Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
