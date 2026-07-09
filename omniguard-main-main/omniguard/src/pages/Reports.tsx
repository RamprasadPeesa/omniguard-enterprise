import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, LoadingSpinner, RelativeTime } from '../components/ui'
import { FileDown, FileText, ShieldCheck, Activity, Download, RefreshCw } from 'lucide-react'

interface ScanRow { id: string; status: string; created_at: string; duration_seconds: number | null; summary: Record<string, number> | null }
interface FindingRow { id: string; severity: string; status: string; risk_score: number; created_at: string; resolved_at: string | null; scanner: string }
interface AuditRow { id: string; action: string; created_at: string; resource_type: string; resource_name: string | null }

function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function Reports() {
  const { currentOrganizationId } = useAuth()
  const [scans, setScans] = useState<ScanRow[]>([])
  const [findings, setFindings] = useState<FindingRow[]>([])
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const [s, f, l] = await Promise.all([
      supabase.from('scans').select('id, status, created_at, duration_seconds, summary').eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }).limit(100),
      supabase.from('findings').select('id, severity, status, risk_score, created_at, resolved_at, scanner').eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }).limit(500),
      supabase.from('audit_logs').select('id, action, created_at, resource_type, resource_name').eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }).limit(100),
    ])
    setScans((s.data || []) as ScanRow[])
    setFindings((f.data || []) as FindingRow[])
    setLogs((l.data || []) as AuditRow[])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const metrics = useMemo(() => {
    const open = findings.filter(f => !['resolved','suppressed','false_positive'].includes(f.status))
    const critical = open.filter(f => f.severity === 'critical').length
    const high = open.filter(f => f.severity === 'high').length
    const avgRisk = open.length ? Math.round(open.reduce((s, f) => s + (f.risk_score || 0), 0) / open.length) : 0
    const resolved = findings.filter(f => f.status === 'resolved' && f.resolved_at)
    const mttr = resolved.length
      ? Math.round((resolved.reduce((s, f) => s + (new Date(f.resolved_at!).getTime() - new Date(f.created_at).getTime()), 0) / resolved.length / 3600000) * 10) / 10
      : 0
    return { openCount: open.length, critical, high, avgRisk, mttr, scanCount: scans.length, completed: scans.filter(s => s.status === 'completed').length, failed: scans.filter(s => s.status === 'failed').length }
  }, [findings, scans])

  const exportJson = () => download(`omniguard-report.json`, JSON.stringify({ generated_at: new Date().toISOString(), scans, findings, logs, metrics }, null, 2))
  const exportCsv = () => {
    const rows = ['type,id,severity_or_action,status,risk,created_at']
    findings.forEach(f => rows.push(`finding,${f.id},${f.severity},${f.status},${f.risk_score},${f.created_at}`))
    scans.forEach(s => rows.push(`scan,${s.id},,${s.status},${s.duration_seconds ?? ''},${s.created_at}`))
    logs.forEach(l => rows.push(`audit,${l.id},${l.action},${l.resource_type},,${l.created_at}`))
    download(`omniguard-report.csv`, rows.join('\n'), 'text/csv')
  }
  const exportMd = () => download(`omniguard-report.md`, [
    '# OmniGuard Security Report', `Generated: ${new Date().toISOString()}`, '',
    `## Summary`, `- Open findings: ${metrics.openCount}`, `- Critical: ${metrics.critical}`, `- High: ${metrics.high}`,
    `- Average risk: ${metrics.avgRisk}`, `- Scans: ${metrics.scanCount}`, `- Completed: ${metrics.completed}`,
    `- Failed: ${metrics.failed}`, `- MTTR: ${metrics.mttr}h`, '',
    `## Recent Activity`, ...logs.slice(0, 10).map(l => `- ${l.action.replace(/_/g, ' ')} — ${l.resource_type} ${l.resource_name || ''} (${new Date(l.created_at).toLocaleString()})`),
  ].join('\n'), 'text/markdown')

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Reports"
        description="Executive summaries, compliance evidence, and data exports"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={exportCsv} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
            <button onClick={exportJson} className="btn-secondary"><FileDown className="w-4 h-4" /> JSON</button>
            <button onClick={exportMd} className="btn-primary"><FileText className="w-4 h-4" /> Markdown</button>
          </div>
        }
      />

      {loading ? <LoadingSpinner label="Loading report data..." /> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            <StatCard label="Security Score" value={Math.max(0, 100 - metrics.avgRisk)} sublabel="Risk-adjusted" icon={ShieldCheck} />
            <StatCard label="Critical Findings" value={metrics.critical} sublabel="Open" icon={Activity} />
            <StatCard label="Scans Completed" value={metrics.completed} sublabel={`${metrics.failed} failed`} icon={Activity} />
            <StatCard label="MTTR" value={`${metrics.mttr}h`} sublabel="Mean time to resolve" icon={FileText} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="p-5">
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Executive Summary</h2>
              <div className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <p>{metrics.openCount} open finding{metrics.openCount === 1 ? '' : 's'} across {metrics.scanCount} scan{metrics.scanCount === 1 ? '' : 's'}.</p>
                <p>{metrics.critical} critical and {metrics.high} high severity issues require attention.</p>
                <p>Average open-risk score is {metrics.avgRisk} with a {metrics.mttr}h mean time to resolve.</p>
              </div>
            </Card>

            <Card padding="p-5">
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Recent Activity</h2>
              <div className="space-y-2 max-h-56 overflow-auto scrollbar">
                {logs.slice(0, 8).map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-3 p-2 rounded" style={{ background: 'var(--surface-2)' }}>
                    <div>
                      <p className="text-sm capitalize" style={{ color: 'var(--text)' }}>{l.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{l.resource_type}{l.resource_name ? ` · ${l.resource_name}` : ''}</p>
                    </div>
                    <RelativeTime date={l.created_at} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
