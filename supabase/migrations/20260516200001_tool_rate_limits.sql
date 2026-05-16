CREATE TABLE IF NOT EXISTS tool_rate_limits (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool       TEXT NOT NULL,
  ip         TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_rate_limits_tool_ip ON tool_rate_limits(tool, ip, created_at DESC);
