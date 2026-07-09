ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint text;
CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings(fingerprint);
