-- Nexus Alpha Hardening Migration: Object-Level Ownership & RLS
-- 2026-05-01

-- 1. Pipelines Table
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Ties to auth.users
  repos TEXT[] NOT NULL,
  status TEXT DEFAULT 'running',
  progress INTEGER DEFAULT 0,
  agent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pipeline Logs Table (for durable, isolated log streaming)
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  log_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

-- 4. RBAC Policies

-- Policy: Users can only see their own pipelines
CREATE POLICY select_own_pipelines ON pipelines
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own pipelines
CREATE POLICY insert_own_pipelines ON pipelines
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pipelines (e.g., status changes)
CREATE POLICY update_own_pipelines ON pipelines
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can see logs for their own pipelines
CREATE POLICY select_own_logs ON pipeline_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_logs.pipeline_id
      AND pipelines.user_id = auth.uid()
    )
  );

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_pipeline_id ON pipeline_logs(pipeline_id);
