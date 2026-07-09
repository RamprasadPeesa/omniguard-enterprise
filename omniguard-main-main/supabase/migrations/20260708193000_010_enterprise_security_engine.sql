-- Section 2: Enterprise Security Engine persistence

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scan_type_check;
ALTER TABLE scans ADD CONSTRAINT scans_scan_type_check CHECK (
  scan_type IN (
    'full', 'quick', 'incremental', 'secrets', 'dependencies', 'sast', 'iac',
    'container', 'dockerfile', 'terraform', 'kubernetes', 'github_actions',
    'azure_pipeline', 'cloudformation', 'ansible', 'helm', 'yaml', 'json',
    'config', 'license', 'sbom', 'inventory', 'policy'
  )
);

ALTER TABLE findings ADD COLUMN IF NOT EXISTS business_impact text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS suggested_commit text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS references text[] NOT NULL DEFAULT '{}';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS epss_score real;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS compliance_mapping jsonb NOT NULL DEFAULT '{}';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_remediation_details jsonb NOT NULL DEFAULT '{}';

ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_policy_type_check;
ALTER TABLE policies ADD CONSTRAINT policies_policy_type_check CHECK (
  policy_type IN ('yaml', 'json', 'rego', 'builtin', 'markdown', 'pdf', 'docx', 'txt', 'html', 'confluence')
);
ALTER TABLE policies ADD COLUMN IF NOT EXISTS source_document_type text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS structured_rules jsonb NOT NULL DEFAULT '[]';

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check CHECK (
  document_type IN ('policy', 'procedure', 'standard', 'audit', 'report', 'architecture', 'playbook', 'engineering_guideline', 'other')
);

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
        AND om.role IN ('owner', 'admin', 'security_lead')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_suppression_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'security_lead')
    )
  );

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
