# Payment Module Integration: XflowPay + Easebuzz

**Date:** 2026-05-26 | **Status:** Easebuzz wired in code, env vars pending on Vercel

---

## What Each System Does

| System | Role | Type |
|--------|------|------|
| **XflowPay** | Payment reference generator + manual tracking | Internal utility (not a payment gateway) |
| **Easebuzz** | Payment gateway — processes credit/debit cards, UPI, net banking | External payment processor |
| **Skydo** | Fallback payment gateway | External payment processor |

### XflowPay is NOT a payment gateway

XflowPay (`lib/xflow.ts`) only generates a unique reference ID (`XFLW-{timestamp}-{shortId}`) for tracking manual bank transfers. It does NOT process payments, does NOT have an API, and does NOT interact with any bank. Think of it as an invoice number generator.

### Easebuzz IS the payment gateway

Easebuzz handles the actual card/UPI/net-banking payment. The user is redirected to an Easebuzz-hosted payment page, pays there, and Easebuzz sends a webhook back to our server when payment succeeds.

---

## Full Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

USER JOURNEY
═══════════

  Sign Up ──► Onboarding ──► Select Plan ──► /checkout
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
                    ▼                            ▼                            ▼
           ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
           │ Pay with Card │            │ Manual ACH    │            │  Book a Call │
           │   (PRIMARY)   │            │ (FALLBACK)    │            │  (SUPPORT)   │
           └──────┬────────┘            └──────┬────────┘            └──────────────┘
                  │                            │
                  ▼                            ▼
   POST /api/payment/create-checkout    Show VBAN details
                  │                    (JPMorgan Chase)
                  │                    User wires money
     ┌────────────┼────────────┐       manually
     │            │            │            │
     ▼            ▼            ▼            │
┌─────────┐ ┌─────────┐ ┌─────────┐        │
│Easebuzz │ │  Skydo  │ │ MANUAL  │        │
│(primary)│ │(fallback│ │  VBAN   │        │
└────┬────┘ └────┬────┘ └────┬────┘        │
     │            │            │            │
     │  User      │  User      │  User      │
     │  pays on   │  pays on   │  wires     │
     │  Easebuzz  │  Skydo     │  money     │
     │  page      │  page      │            │
     │            │            │            │
     ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────┐
│              PAYMENT CONFIRMATION                │
│                                                  │
│  Easebuzz/Skydo            Manual ACH            │
│  ─────────────             ──────────            │
│  Webhook POST              Finance Agent cron    │
│  /api/payment/webhook      checks bank account   │
│       │                    (manual process)       │
│       ▼                          │               │
│  Auto-activates                 ▼                │
│  subscription            Admin manually          │
│       │                  activates in            │
│       ▼                  Supabase                │
│  ┌──────────┐                  │                │
│  │ Profile  │                  │                │
│  │ active   │◄─────────────────┘                │
│  └────┬─────┘                                   │
│       │                                          │
│       ▼                                          │
│  Resend activation email                         │
│  "You're live."                                  │
└─────────────────────────────────────────────────┘


SERVER-SIDE FLOW (DETAIL)
═════════════════════════

  ┌──────────────────────────────────────────────────────────────────┐
  │ POST /api/payment/create-checkout                                │
  │                                                                  │
  │ 1. Receives { plan, userId, email }                             │
  │ 2. Looks up plan in PLANS (lib/stripe.ts)                       │
  │ 3. Generates txnid = "txn_{timestamp}_{random}"                  │
  │ 4. INSERT INTO pending_transactions (txnid, user_id, plan)      │
  │ 5. Checks env vars in order:                                     │
  │    ├── EASEBUZZ_{PLAN}_URL  →  returns { url, method: "card" }  │
  │    ├── SKYDO_{PLAN}_URL     →  returns { url, method: "card" }  │
  │    └── neither set          →  returns { method: "manual",      │
  │                                         vban: { bank, acct } }   │
  └──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Frontend (/checkout)                                             │
  │                                                                  │
  │ if (data.url) → window.location.href = data.url  (redirect)     │
  │ if (data.method === "manual") → show bank transfer details       │
  └──────────────────────────────────────────────────────────────────┘


WEBHOOK FLOW (Easebuzz → Us)
═════════════════════════════

  Easebuzz payment page
        │
        │ User completes payment
        ▼
  Easebuzz POST → /api/payment/webhook
        │
        │ Body: { txnid, status: "success", email }
        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ POST /api/payment/webhook                                        │
  │                                                                  │
  │ 1. Extract txnid from body.txnid || body.client_reference_id    │
  │ 2. Check status === "success" / "completed" / "paid"            │
  │ 3. Look up pending_transactions WHERE txnid = ?                  │
  │ 4. UPDATE profiles SET                                          │
  │      subscription_status = "active",                             │
  │      plan = txn.plan,                                            │
  │      subscription_activated_at = NOW()                           │
  │    WHERE id = txn.user_id                                        │
  │ 5. Send activation email via Resend ("You're live.")            │
  │ 6. DELETE FROM pending_transactions WHERE txnid = ?             │
  └──────────────────────────────────────────────────────────────────┘
```

---

## How to Configure Easebuzz (Step by Step)

### Step 1: Create an Easebuzz Account

1. Go to https://easebuzz.in
2. Sign up as a business/merchant
3. Complete KYC verification (PAN, bank account, business proof)
4. Once approved, go to Dashboard → API Keys
5. Note your **Merchant Key**, **Salt**, and **Webhook Secret**

### Step 2: Create Payment Pages for Each Plan

In the Easebuzz dashboard:

1. Go to **Payment Pages** → **Create New**
2. Create 4 payment pages, one per plan:

| Plan | Name | Amount | Type |
|------|------|--------|------|
| Pilot | "Founder's Pilot — Prospecting OS" | ₹1,499 | One-time |
| Growth | "Growth — Prospecting OS" | ₹2,499 | One-time |
| Scale | "Scale — Prospecting OS" | ₹4,999 | One-time |
| Micro | "Micro-Offer — Prospecting OS" | ₹997 | One-time |

3. For each page, configure:
   - **Return URL**: `https://app.flow-forges.com/prospecting-os/dashboard`
   - **Webhook URL**: `https://app.flow-forges.com/prospecting-os/api/payment/webhook`
   - Enable **"Pass transaction ID in webhook"** if available

4. Copy each payment page URL (they'll look like `https://pay.easebuzz.in/...`)

### Step 3: Set Environment Variables on Vercel

Go to Vercel → lead-engine project → Settings → Environment Variables:

```
EASEBUZZ_PILOT_URL   = https://pay.easebuzz.in/payment/pilot-page-id
EASEBUZZ_GROWTH_URL  = https://pay.easebuzz.in/payment/growth-page-id
EASEBUZZ_SCALE_URL   = https://pay.easebuzz.in/payment/scale-page-id
EASEBUZZ_MICRO_URL   = https://pay.easebuzz.in/payment/micro-page-id
```

Once these are set, the "Pay with Credit Card" button on `/checkout` will redirect users to the Easebuzz payment page. The webhook will auto-activate their subscription.

### Step 4: Verify Webhook Configuration

In the Easebuzz dashboard, set the webhook URL:
```
https://app.flow-forges.com/prospecting-os/api/payment/webhook
```

Our webhook handler (`app/api/payment/webhook/route.ts`) expects:
- `txnid` — the transaction ID we generate (passed via `?txnid=` query param on the payment URL)
- `status` — "success" / "completed" / "paid"
- `email` — customer email

### Step 5: Test End-to-End

1. Sign up on the live site at `https://app.flow-forges.com/prospecting-os/signup`
2. Go through onboarding, select a plan
3. On `/checkout`, click "Pay with Credit Card"
4. You should be redirected to the Easebuzz payment page
5. Complete payment (use test card if in test mode)
6. You should be redirected back to the dashboard
7. Check your email for the activation email from Resend
8. Verify `profiles.subscription_status` = "active" in Supabase

---

## What Happens Without Easebuzz (Current State)

If no `EASEBUZZ_*_URL` env vars are set, the system falls back to **Manual ACH/Wire**:

1. User clicks "Pay with Credit Card"
2. API returns `{ method: "manual", vban: { bank, accountNumber, routingNumber } }`
3. The checkout page shows the JPMorgan Chase bank details
4. User manually wires the money
5. Finance Agent cron (`/api/agent/finance/cron`) checks for pending payments daily at 9 AM
6. Admin (you) verifies receipt in your bank account
7. Admin manually sets `subscription_status = "active"` in Supabase or uses the Finance Agent Telegram bot

This works but requires manual intervention. Easebuzz automates steps 5-7.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/xflow.ts` | Payment reference generator (`XFLW-xxx` IDs) — NOT a gateway |
| `lib/stripe.ts` | Plan definitions (prices, features) — misnamed, has nothing to do with Stripe |
| `app/api/payment/create-checkout/route.ts` | Receives plan choice, returns Easebuzz/Skydo URL or VBAN details |
| `app/api/payment/webhook/route.ts` | Receives Easebuzz/Skydo callback, activates subscription |
| `app/checkout/page.tsx` | User-facing payment page with card button + manual ACH details |
| `app/onboarding/page.tsx` | Plan selection → saves plan + subscription_status → redirects to /checkout |
| `lib/finance-agent.ts` | Finance Agent cron — monitors pending payments, sends Telegram alerts |
| `app/api/agent/finance/cron/route.ts` | 9 AM daily cron — runs finance agent jobs |

---

## Database Tables

### `pending_transactions`
Tracks payments in-flight (created before user goes to Easebuzz):

| Column | Type | Purpose |
|--------|------|---------|
| `txnid` | TEXT PK | Unique transaction ID (`txn_{ts}_{random}`) |
| `user_id` | UUID | References auth.users |
| `plan` | TEXT | pilot / growth / scale / micro |
| `amount` | INT | Setup amount in USD |
| `created_at` | TIMESTAMPTZ | When checkout was initiated |

### `profiles` (payment-relevant columns)

| Column | Type | Values |
|--------|------|--------|
| `subscription_status` | TEXT | pending_payment / active / cancelled / null |
| `plan` | TEXT | pilot / growth / scale / micro / null |
| `subscription_activated_at` | TIMESTAMPTZ | Set when webhook fires or admin activates |
| `payment_ref` | TEXT | XflowPay reference (XFLW-xxx) |
| `payment_method` | TEXT | easebuzz / skydo / manual |
| `xflow_transaction_id` | TEXT | Legacy — kept for existing records |

---

## Quick Reference: System Roles

```
XflowPay = Reference number generator (like an invoice number)
           Does NOT process money. Does NOT have an API key.
           Used for: tracking manual bank transfers.

Easebuzz = Payment gateway (like Stripe, Razorpay)
           Processes credit/debit cards, UPI, net banking.
           User is redirected to Easebuzz to pay.
           Easebuzz calls our webhook when payment completes.

Skydo    = Fallback payment gateway (same pattern as Easebuzz)
           Only used if Easebuzz URLs are not configured.

VBAN     = Manual bank transfer (JPMorgan Chase)
           Last-resort fallback when no payment gateway is configured.
           User wires money manually. Admin verifies receipt.
```
