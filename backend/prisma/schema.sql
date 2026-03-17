-- ClauseAI Backend - Supabase Postgres Schema
-- Run this in Supabase SQL Editor to create tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- users (id matches Supabase Auth user id; upsert on login)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- companies
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size TEXT,
  ai_use_case TEXT,
  monthly_ai_spend_estimate TEXT,
  compliance_requirement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_owner ON companies(owner_user_id);

-- vendor_connections
CREATE TABLE IF NOT EXISTS vendor_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL CHECK (vendor_name IN ('OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith')),
  encrypted_api_key TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'active' CHECK (connection_status IN ('active', 'failed', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, vendor_name)
);

CREATE INDEX idx_vendor_connections_company ON vendor_connections(company_id);

-- scan_jobs
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_jobs_company ON scan_jobs(company_id);
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);

-- scan_logs
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_job_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
  vendor TEXT,
  message TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_logs_job ON scan_logs(scan_job_id);

-- ai_systems (scan_job_id links to the scan that discovered this system)
CREATE TABLE IF NOT EXISTS ai_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scan_job_id UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  system_type TEXT,
  team_owner TEXT,
  environment TEXT,
  monthly_cost_estimate DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_systems_company ON ai_systems(company_id);
CREATE INDEX idx_ai_systems_scan_job ON ai_systems(scan_job_id);
CREATE INDEX idx_ai_systems_vendor ON ai_systems(vendor);

-- compliance_flags
CREATE TABLE IF NOT EXISTS compliance_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'acknowledged'))
);

CREATE INDEX idx_compliance_flags_system ON compliance_flags(system_id);

-- system_inferences (AI-inferred metadata; user can override)
CREATE TABLE IF NOT EXISTS system_inferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  inferred_value TEXT,
  user_override TEXT,
  confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(system_id, field_name)
);

CREATE INDEX idx_system_inferences_system ON system_inferences(system_id);

-- RLS policies (optional; enable if using Supabase RLS)
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vendor_connections ENABLE ROW LEVEL SECURITY;
-- etc.

-- Trigger to sync auth.users to users table (call from Supabase Auth hook or Edge Function)
-- Or use Supabase Dashboard: Auth -> Users; replicate to public.users via trigger.

-- Migration: add updated_at to existing vendor_connections (run if table was created before this column existed)
-- ALTER TABLE vendor_connections ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
