/*
# Policy Chunks (RAG), AI Config, API Key Usage, Rate Limits, AI Cache, Usage Metering

1. policy_chunks table - Vector-searchable policy chunks for RAG
2. match_policy_chunks() - Vector similarity search
3. findings: ai_provider, ai_model, policy_violations columns
4. scans: commit_message, commit_author columns  
5. organizations: ai_config JSONB column
6. api_key_usage table - API key usage tracking
7. rate_limit_counters table - Sliding window rate limiting
8. ai_cache table - AI response caching
9. ai_usage table - AI usage metering
10. integration_events table - Integration event log
11. organizations: rate_limits JSONB column
12. integrations: webhook_secret column
*/

-- Policy chunks for RAG
CREATE TABLE IF NOT EXISTS policy_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id       UUID REFERENCES policies(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL DEFAULT 0,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE policy_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chunk_select" ON policy_chunks;
CREATE POLICY "chunk_select" ON policy_chunks FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "chunk_insert" ON policy_chunks;
CREATE POLICY "chunk_insert" ON policy_chunks FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "chunk_update" ON policy_chunks;
CREATE POLICY "chunk_update" ON policy_chunks FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "chunk_delete" ON policy_chunks;
CREATE POLICY "chunk_delete" ON policy_chunks FOR DELETE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
);

CREATE OR REPLACE FUNCTION match_policy_chunks(
  p_org_id UUID, query_embedding vector(1536), match_count INTEGER DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, policy_id UUID, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT pc.id, pc.content, pc.policy_id,
    1 - (pc.embedding <=> query_embedding) AS similarity
  FROM policy_chunks pc
  WHERE pc.organization_id = p_org_id AND pc.embedding IS NOT NULL
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add missing columns to findings
ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_provider TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS policy_violations TEXT[] NOT NULL DEFAULT '{}';

-- Add ai_config to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_config JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_policy_chunks_org ON policy_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_findings_org_status ON findings(organization_id, status);

-- Auto-enqueue scan trigger
CREATE OR REPLACE FUNCTION enqueue_scan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'queued' THEN
    INSERT INTO scan_queue (scan_id, repository_id, organization_id)
    VALUES (NEW.id, NEW.repository_id, NEW.organization_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_enqueue_scan ON scans;
CREATE TRIGGER trigger_enqueue_scan AFTER INSERT ON scans FOR EACH ROW EXECUTE FUNCTION enqueue_scan();

-- API Key Usage Tracking
CREATE TABLE IF NOT EXISTS api_key_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id          UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'GET',
  status_code     INTEGER NOT NULL DEFAULT 200,
  response_ms     INTEGER,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_select" ON api_key_usage;
CREATE POLICY "usage_select" ON api_key_usage FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active')
);
CREATE POLICY "usage_insert" ON api_key_usage FOR INSERT TO service_role WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(key_id, created_at DESC);

-- Rate Limit Windows
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key             TEXT NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rl_service" ON rate_limit_counters;
CREATE POLICY "rl_service" ON rate_limit_counters FOR ALL TO service_role USING (true) WITH CHECK (true);

-- AI Response Cache
CREATE TABLE IF NOT EXISTS ai_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  prompt_hash     TEXT NOT NULL,
  response_text   TEXT NOT NULL,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cache_service" ON ai_cache;
CREATE POLICY "cache_service" ON ai_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache(cache_key);

-- AI Usage Metering
CREATE TABLE IF NOT EXISTS ai_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_id         UUID REFERENCES scans(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'medium',
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  cache_hit       BOOLEAN NOT NULL DEFAULT false,
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_select" ON ai_usage;
CREATE POLICY "ai_usage_select" ON ai_usage FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "ai_usage_service" ON ai_usage;
CREATE POLICY "ai_usage_service" ON ai_usage FOR INSERT TO service_role WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org ON ai_usage(organization_id, created_at DESC);

-- Rate limit config per org plan
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS rate_limits JSONB NOT NULL DEFAULT '{
  "scans_per_hour": 20,
  "scans_per_day": 100,
  "api_requests_per_minute": 60,
  "api_requests_per_hour": 1000
}';

-- Integration events log
CREATE TABLE IF NOT EXISTS integration_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id  UUID REFERENCES integrations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ie_select" ON integration_events;
CREATE POLICY "ie_select" ON integration_events FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "ie_service" ON integration_events;
CREATE POLICY "ie_service" ON integration_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- integrations: webhook_secret
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
