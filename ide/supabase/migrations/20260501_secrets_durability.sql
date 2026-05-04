-- Nexus Alpha: Persistent Secret Storage
-- 2026-05-01

-- 1. User Secrets Table
CREATE TABLE IF NOT EXISTS user_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Ties to auth.users
  key TEXT NOT NULL,
  value TEXT NOT NULL, -- Should be encrypted in production
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- 2. Enable RLS
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can only see/modify their own secrets
CREATE POLICY select_own_secrets ON user_secrets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY insert_own_secrets ON user_secrets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY update_own_secrets ON user_secrets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY delete_own_secrets ON user_secrets
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id ON user_secrets(user_id);
