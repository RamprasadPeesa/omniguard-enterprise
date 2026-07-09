/*
# AI Keys Vault, Enterprise Security Engine, Finding Fingerprints

1. organizations: ai_keys_vault_id column
2. user_secrets table - per-user encrypted secret store
3. Expanded scan_type and policy_type CHECK constraints
4. findings: business_impact, suggested_commit, references, epss_score, compliance_mapping, ai_remediation_details
5. policies: source_document_type, structured_rules
6. organization_suppression_rules table
7. project_risk_history table
8. findings: fingerprint column
*/

-- AI keys vault reference
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_keys_vault_id uuid;

-- Per-user secrets
CREATE TABLE IF NOT EXISTS user_secrets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  vault_id    uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, key)
);
ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_secrets_select_own" ON user_secrets;
CREATE POLICY "user_secrets_select_own" ON user_secrets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_secrets_insert_own" ON user_secrets;
CREATE POLICY "user_secrets_insert_own" ON user_secrets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_secrets_update_own" ON user_secrets;
CREATE POLICY "user_secrets_update_own" ON user_secrets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_secrets_delete_own" ON user_secrets;
CREATE POLICY "user_secrets_delete_own" ON user_secrets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON user_secrets;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON user_secrets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Expanded scan_type CHECK
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scan_type_check;
ALTER TABLE scans ADD CONSTRAINT scans_scan_type_check CHECK (
  scan_type IN (
    'full', 'quick', 'incremental', 'secrets', 'dependencies', 'sast', 'iac',
    'container', 'dockerfile', 'terraform', 'kubernetes', 'github_actions',
    'azure_pipeline', 'cloudformation', 'ansible', 'helm', 'yaml', 'json',
    'config', 'license', 'sbom', 'inventory', 'policy'
  )
);

-- findings new columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS business_impact text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS suggested_commit text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS "references" text[] NOT NULL DEFAULT '{}';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS epss_score real;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS compliance_mapping jsonb NOT NULL DEFAULT '{}';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_remediation_details jsonb NOT NULL DEFAULT '{}';

-- policies new columns and expanded type
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_policy_type_check;
ALTER TABLE policies ADD CONSTRAINT policies_policy_type_check CHECK (
  policy_type IN ('yaml', 'json', 'rego', 'builtin', 'markdown', 'pdf', 'docx', 'txt', 'html', 'confluence')
);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS source_document_type text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS structured_rules jsonb NOT NULL DEFAULT '[]';

-- documents expanded type
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check CHECK (
  document_type IN ('policy', 'procedure', 'standard', 'audit', 'report', 'architecture', 'playbook', 'engineering_guideline', 'other')
);

-- Suppression rules
CREATE TABLE IF NOT EXISTS organization_suppression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scanner text,
  rule_id text,
  file_pattern text,
  false_positive_likelihood real NOT NULL DEFAULT 0.5 CHECK (false_positive_likelihood >= 0 AND false_positive_likelihood <= 1),
  dismiss_count integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  generated_from_finding_id uuid REFERENCES findings(id) ON DELETE SET NULL,
  last_dismissed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scanner, rule_id, file_pattern)
);
ALTER TABLE organization_suppression_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppression_select_member" ON organization_suppression_rules;
CREATE POLICY "suppression_select_member" ON organization_suppression_rules FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_suppression_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "suppression_admin_all" ON organization_suppression_rules;
CREATE POLICY "suppression_admin_all" ON organization_suppression_rules FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_suppression_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_suppression_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

-- Project risk history
CREATE TABLE IF NOT EXISTS project_risk_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES scans(id) ON DELETE SET NULL,
  score real NOT NULL CHECK (score >= 0 AND score <= 100),
  factors jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE project_risk_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_history_select_member" ON project_risk_history;
CREATE POLICY "risk_history_select_member" ON project_risk_history FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = project_risk_history.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_suppression_rules_org_rule ON organization_suppression_rules(organization_id, scanner, rule_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_project_risk_history_repo ON project_risk_history(repository_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_compliance_mapping ON findings USING gin(compliance_mapping);

-- Finding fingerprints
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint text;
CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings(fingerprint);
