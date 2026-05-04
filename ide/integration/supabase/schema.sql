-- Nexus Alpha Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable pgvector for semantic search
create extension if not exists vector;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 1. AGENT MEMORY (Backed up from Mem0 for durability)                       │
-- └─────────────────────────────────────────────────────────────────────────────┘
create table if not exists agent_memory (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  content text not null,
  metadata jsonb default '{}',
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists agent_memory_user_idx on agent_memory(user_id);
create index if not exists agent_memory_content_idx on agent_memory using gin(to_tsvector('english', content));

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 2. SECRETS (Encrypted API keys, tokens)                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘
create table if not exists secrets (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 3. LOGS (Activity tracking)                                                │
-- └─────────────────────────────────────────────────────────────────────────────┘
create table if not exists logs (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists logs_type_idx on logs(type);
create index if not exists logs_created_idx on logs(created_at desc);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 4. VECTOR STORE (for RAG/knowledge)                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists documents_embedding_idx on documents using ivfflat (embedding vector_cosine_ops);

-- Self-Learning: Match documents for semantic search
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 5. SELF-HEALING TRACKING (Track failures & auto-remedy)                    │
-- └─────────────────────────────────────────────────────────────────────────────┘
create table if not exists healing_log (
  id uuid default gen_random_uuid() primary key,
  issue_type text not null,
  issue_details jsonb,
  remedy_applied text,
  success boolean,
  created_at timestamptz default now()
);

-- Function: Auto-remedy for common integration failures
create or replace function handle_integration_failure(
  p_issue_type text,
  p_issue_details jsonb
)
returns boolean
language plpgsql
as $$
declare
  v_remedy text;
begin
  -- Self-Healing Logic: Map issues to remedies
  case p_issue_type
    when 'api_timeout' then
      update secrets set value = 'retry' where key = 'retry_policy';
      v_remedy := 'Enabled retry policy';
    when 'auth_failure' then
      update secrets set value = 'refresh' where key = 'auth_status';
      v_remedy := 'Initiated token refresh';
    when 'rate_limit' then
      update secrets set value = 'backoff' where key = 'rate_limit_policy';
      v_remedy := 'Applied exponential backoff';
    else
      v_remedy := 'Logged for manual review';
  end case;

  -- Log the healing action
  insert into healing_log (issue_type, issue_details, remedy_applied, success)
  values (p_issue_type, p_issue_details, v_remedy, true);

  return true;
end;
$$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 6. AGENT STATE (Track agent health & learning)                             │
-- └─────────────────────────────────────────────────────────────────────────────┘
create table if not exists agent_state (
  id uuid default gen_random_uuid() primary key,
  agent_id text unique not null,
  status text default 'idle',
  last_task text,
  performance_score float default 0.0,
  learnings jsonb default '[]',
  updated_at timestamptz default now()
);

-- Function: Record agent learning
create or replace function record_agent_learning(
  p_agent_id text,
  p_lesson text,
  p_success boolean
)
returns void
language plpgsql
as $$
begin
  update agent_state
  set 
    learnings = learnings || jsonb_build_object('lesson', p_lesson, 'success', p_success, 'timestamp', now()),
    performance_score = case when p_success then performance_score + 0.01 else performance_score - 0.01 end,
    updated_at = now()
  where agent_id = p_agent_id;

  if not found then
    insert into agent_state (agent_id, learnings, performance_score)
    values (p_agent_id, jsonb_build_array(jsonb_build_object('lesson', p_lesson, 'success', p_success, 'timestamp', now())), 0.5);
  end if;
end;
$$;