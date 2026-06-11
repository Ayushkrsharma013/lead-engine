#!/usr/bin/env bash
# ============================================================================
# Prospecting OS — Test Suite Setup Script
# Installs dependencies, creates test DB, and runs smoke tests.
#
# Usage:
#   bash tests/setup.sh          # Full setup
#   bash tests/setup.sh --quick  # Skip Playwright browser install
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$SCRIPT_DIR"
QUICK_MODE=false

if [[ "${1:-}" == "--quick" ]]; then
  QUICK_MODE=true
fi

echo "═══════════════════════════════════════════════════════════"
echo "  Prospecting OS — Test Suite Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── 1. Node dependencies ─────────────────────────────────────────────────────
echo "─── [1/4] Installing Node dependencies ───"
cd "$TEST_DIR"
npm install --silent
echo "✅ Node dependencies installed"

# ── 2. Playwright browsers ───────────────────────────────────────────────────
if [ "$QUICK_MODE" = false ]; then
  echo ""
  echo "─── [2/4] Installing Playwright browsers ───"
  npx playwright install --with-deps chromium 2>&1 | tail -5
  echo "✅ Playwright browsers installed"
else
  echo ""
  echo "─── [2/4] Skipping Playwright browsers (--quick mode) ───"
fi

# ── 3. Python dependencies ───────────────────────────────────────────────────
echo ""
echo "─── [3/4] Installing Python dependencies ───"
pip install -r "$TEST_DIR/requirements.txt" --quiet 2>&1 || echo "⚠️  Python deps skipped (pip not available or already installed)"
echo "✅ Python dependencies ready"

# ── 4. Initialize test database ──────────────────────────────────────────────
echo ""
echo "─── [4/4] Initializing test database ───"
npx ts-node -e "
const { getTestDb, seedTestData, tableExists } = require('./utils/test-db');
const db = getTestDb();
seedTestData();
const tables = ['profiles', 'clients', 'client_workspaces', 'appointments', 'client_leads', 'client_icebreakers'];
for (const t of tables) {
  const exists = tableExists(t);
  console.log(exists ? '  ✅ ' + t : '  ❌ ' + t + ' MISSING');
}
console.log('');
console.log('✅ Test database initialized: tests/db/test-environment.db');
db.close();
"
echo ""

# ── Check env ────────────────────────────────────────────────────────────────
echo "─── Environment Check ───"
if [ -f "$TEST_DIR/.env" ]; then
  echo "✅ tests/.env found"
else
  echo "⚠️  tests/.env not found — copy tests/.env.test to tests/.env and fill in values"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Setup Complete!"
echo ""
echo "  Next steps:"
echo "  1. Copy tests/.env.test → tests/.env and fill in secrets"
echo "  2. Run: npm run test:security    (security scans)"
echo "  3. Run: npm run test:ci          (full suite)"
echo "═══════════════════════════════════════════════════════════"
