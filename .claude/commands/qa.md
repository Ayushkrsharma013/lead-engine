---
name: qa
description: Run full QA sanity suite using agent-browser against the Prospecting OS app
agent: QA_Bot
---

# /qa — QA_Bot Sanity Suite

Run automated browser and API tests against the running dev server.

## Usage
```
/qa              # Run full sanity suite
/qa landing      # Landing page only
/qa booking      # Booking flow only
/qa dashboard    # Dashboard only
/qa api          # API endpoints only
```

## Prerequisites
- Dev server running on `http://localhost:3000`
- `agent-browser` installed globally

## Test Scenarios
| Suite | Files | Checks |
|-------|-------|--------|
| Landing Page | `tests/scenarios/landing-page.sh` | 16 |
| Booking Flow | `tests/scenarios/booking-flow.sh` | 8 |
| Dashboard | `tests/scenarios/dashboard.sh` | 7 |
| API | `tests/scenarios/api.sh` | 6 |
| **Full** | `tests/sanity.sh` | **37** |
