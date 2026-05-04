"""
Nexus Alpha - Create Tables via REST API fallback
"""

import os
os.environ['SUPABASE_URL'] = 'https://aganpaepissvuamstmol.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnYW5wYWVwaXNzdnVhbXN0bW9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4MzQ3MywiZXhwIjoyMDkyOTU5NDczfQ.zqF39DurClHwBisqPYysEi2I_LNHen7xD0YhJZg5gUk'

import requests

# Create tables via REST API using service role
SUPABASE_URL = os.environ['SUPABASE_URL']
SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

# Define tables to create (using POSTGREST doesn't support DDL, so we'll try edge function or management API)

# For now, let's check what's in the database
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/",
    headers=headers
)

print("Available endpoints:", response.status_code)
print(response.text[:500] if response.text else "No content")

# Try to create tables via management API
# Note: This typically requires the management API, but let's try a workaround

# Since we can't create tables via REST, let's inform the user
print("\n" + "="*60)
print("TABLES NEED TO BE CREATED MANUALLY")
print("="*60)
print("""
Please run this SQL in your Supabase SQL Editor:

1. Enable pgvector:
   CREATE EXTENSION IF NOT EXISTS vector;

2. Create tables:
   CREATE TABLE secrets (id UUID, key TEXT, value TEXT, created_at TIMESTAMPTZ);
   CREATE TABLE logs (id UUID, type TEXT, details JSONB, created_at TIMESTAMPTZ);
   CREATE TABLE agent_memory (id UUID, user_id TEXT, content TEXT, metadata JSONB, created_at TIMESTAMPTZ);
   CREATE TABLE healing_log (id UUID, issue_type TEXT, issue_details JSONB, remedy_applied TEXT, success BOOL, created_at TIMESTAMPTZ);
   CREATE TABLE agent_state (id UUID, agent_id TEXT UNIQUE, status TEXT, performance_score FLOAT, learnings JSONB, updated_at TIMESTAMPTZ);
   CREATE TABLE documents (id UUID, content TEXT, embedding vector(1536), metadata JSONB, created_at TIMESTAMPTZ);

3. Create indexes:
   CREATE INDEX idx_secrets_key ON secrets(key);
   CREATE INDEX idx_logs_type ON logs(type);
   CREATE INDEX idx_agent_memory_user ON agent_memory(user_id);
   CREATE INDEX idx_healing_log_type ON healing_log(issue_type);
   CREATE INDEX idx_agent_state_agent ON agent_state(agent_id);

4. Create functions:
   CREATE FUNCTION match_documents(query_embedding vector, match_threshold float, match_count int) ...;
   CREATE FUNCTION handle_integration_failure(p_issue_type text, p_issue_details jsonb) ...;
   CREATE FUNCTION record_agent_learning(p_agent_id text, p_lesson text, p_success bool) ...;
""")