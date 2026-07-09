/*
# Worker Queue Functions

1. claim_next_scan() - Workers claim pending scans atomically
2. queue_scan_on_create() - Auto-queue new scans via trigger
*/

CREATE OR REPLACE FUNCTION claim_next_scan(p_worker_id text)
RETURNS TABLE(scan_id uuid, repository_id uuid, organization_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE scan_queue
  SET
    status = 'processing',
    claimed_at = now(),
    worker_id = p_worker_id
  WHERE id = (
    SELECT sq.id FROM scan_queue sq
    JOIN scans s ON s.id = sq.scan_id
    JOIN repositories r ON r.id = s.repository_id
    WHERE sq.status = 'pending'
    AND r.is_active = true
    AND r.deleted_at IS NULL
    ORDER BY sq.priority DESC, sq.created_at ASC
    LIMIT 1
    FOR UPDATE OF sq SKIP LOCKED
  )
  RETURNING scan_queue.scan_id, scan_queue.repository_id, scan_queue.organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION queue_scan_on_create()
RETURNS TRIGGER
AS $$
BEGIN
  INSERT INTO scan_queue (scan_id, organization_id, repository_id, priority, status)
  VALUES (NEW.id, NEW.organization_id, NEW.repository_id, NEW.priority, 'pending');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_scan_created ON scans;
CREATE TRIGGER on_scan_created
  AFTER INSERT ON scans
  FOR EACH ROW
  EXECUTE FUNCTION queue_scan_on_create();

-- Add metadata column to scans
ALTER TABLE scans ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_scan_queue_status_priority 
  ON scan_queue(status, priority DESC, created_at ASC) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, read, created_at DESC) 
  WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time 
  ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_org_active 
  ON repositories(organization_id, risk_score DESC) 
  WHERE deleted_at IS NULL;
