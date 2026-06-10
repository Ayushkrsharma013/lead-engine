-- Unified Onboarding Flow — schema additions
-- Adds plan tracking, onboarding tokens, and payment status to appointments

-- 1. Add plan column (which plan the prospect is interested in)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS plan TEXT;

-- 2. Add onboarding token (UUID for secure onboarding link)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS onboarding_token UUID DEFAULT gen_random_uuid();

-- 3. Track when onboarding email was sent
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS onboarding_sent_at TIMESTAMPTZ;

-- 4. Track payment status for the appointment
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 5. Store ICP config from onboarding (denormalized for token-based access)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS icp_config JSONB;

-- 6. Create index on onboarding_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_appointments_onboarding_token ON appointments(onboarding_token) WHERE onboarding_token IS NOT NULL;

-- 7. Create index on plan for analytics
CREATE INDEX IF NOT EXISTS idx_appointments_plan ON appointments(plan);
