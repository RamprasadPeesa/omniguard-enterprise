import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, LoadingSpinner, EmptyState, RelativeTime, SeverityBadge } from '../components/ui'
import { Shield, TrendingUp, TrendingDown, Minus, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Target, Activity } from 'lucide-react'

interface PostureDetail {
  score: number
  grade: string
  trend: 'up' | 'down' | 'flat'
  changePct: number
  bySeverity: { critical: number; high: number; medium: number; low: number }
  byScanner: Record<string, number>
  byStatus: { open: number; resolved: number; suppressed: number }
  mttrHours: number
  reposScanned: number
  reposUnscanned: number
}

export function SecurityPosture() {
  const { currentOrganizationId } = useAuth()
  const [detail, setDetail] = useState<PostureDetail | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)

    const [{ data: findings }, { data: repos }] = await Promise.all([
      supabase.from('findings').select('severity, status, scanner, risk_score, created_at, resolved_at')
        .eq('organization_id', currentOrganizationId).limit(1000),
      supabase.from('repositories').select('id, last_scan_at, risk_score')
        .eq('organization_id', currentOrganizationId).is('deleted_at', null),
    ])

    const f = findings || []
    const open = f.filter(x => !['resolved','suppressed','false_positive'].includes(x.status))
    const critical = open.filter(x => x.severity === 'critical').length
    const high = open.filter(x => x.severity === 'high').length
    const medium = open.filter(x => x.severity === 'medium').length
    const low = open.filter(x => x.severity === 'low').length

    let score = 100 - (critical * 15 + high * 5 + medium * 2 + low * 0.5)
    score = Math.max(0, Math.min(100, Math.round(score)))
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'

    const now = Date.now()
    const last7 = f.filter(x => new Date(x.created_at).getTime() > now - 7 * 86400000 && !['resolved','suppressed'].includes(x.status)).length
    const prev7 = f.filter(x => {
      const t = new Date(x.created_at).getTime()
      return t > now - 14 * 86400000 && t <= now - 7 * 86400000 && !['resolved','suppressed'].includes(x.status)
    }).length
    const trend: 'up' | 'down' | 'flat' = last7 < prev7 ? 'up' : last7 > prev7 ? 'down' : 'flat'
    const changePct = prev7 > 0 ? Math.round(((prev7 - last7) / prev7) * 100) : 0

    const byScanner: Record<string, number> = {}
    for (const x of open) byScanner[x.scanner] = (byScanner[x.scanner] || 0) + 1

    const resolved = f.filter(x => x.status === 'resolved' && x.resolved_at)
    const mttr = resolved.length
      ? Math.round((resolved.reduce((s, x) => s + (new Date(x.resolved_at!).getTime() - new Date(x.created_at).getTime()), 0) / resolved.length / 3600000) * 10) / 10
      : 0

    const repoList = repos || []
    const weekAgo = now - 7 * 86400000
    const reposScanned = repoList.filter(r => r.last_scan_at && new Date(r.last_scan_at).getTime() > weekAgo).length
    const reposUnscanned = repoList.length - reposScanned

    setDetail({
      score, grade, trend, changePct,
      bySeverity: { critical, high, medium, low },
      byScanner,
      byStatus: { open: open.length, resolved: resolved.length, suppressed: f.filter(x => x.status === 'suppressed').length },
      mttrHours: mttr, reposScanned, reposUnscanned,
    })

    const { data: logs } = await supabase.from('audit_logs').select('action, resource_name, created_at')
      .eq('organization_id', currentOrganizationId).in('action', ['scan_completed','finding_resolved','policy_updated'])
      .order('created_at', { ascending: false }).limit(15)
    setHistory(logs || [])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-8"><LoadingSpinner label="Calculating posture..." /></div>
  if (!detail) return <div className="p-8"><EmptyState icon={Shield} title="No data" description="Connect a repository and run a scan to see your security posture." /></div>

  const trendIcon = detail.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : detail.trend === 'down' ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />
  const trendColor = detail.trend === 'up' ? 'var(--success-text)' : detail.trend === 'down' ? 'var(--critical-text)' : 'var(--text-muted)'

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Security Posture" description="Comprehensive risk assessment across all repositories and findings" />

      {/* Score hero */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card padding="p-6" className="lg:col-span-1 flex flex-col items-center justify-center">
          <div className="relative w-28 h-28 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-soft)', border: '3px solid var(--accent)' }}>
            <div className="text-center">
              <div className="text-4xl font-bold font-mono" style={{ color: 'var(--text)' }}>{detail.score}</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>{detail.grade}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-sm" style={{ color: trendColor }}>
            {trendIcon}
            <span>{detail.trend === 'up' ? 'Improving' : detail.trend === 'down' ? 'Declining' : 'Stable'}{detail.changePct !== 0 && ` ${detail.changePct > 0 ? '+' : ''}${detail.changePct}%`}</span>
          </div>
        </Card>

        <StatCard label="Open Critical" value={detail.bySeverity.critical} sublabel="Requires immediate action" icon={AlertTriangle} />
        <StatCard label="Mean Time to Resolve" value={`${detail.mttrHours}h`} sublabel="Across resolved findings" icon={Activity} />
        <StatCard label="Repositories Scanned" value={`${detail.reposScanned}`} sublabel={`${detail.reposUnscanned} unscanned (7d+)`} icon={Target} />
      </div>

      {/* Severity breakdown + Scanner breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card padding="p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Open Findings by Severity</h2>
          <div className="space-y-4">
            {[
              { label: 'Critical', value: detail.bySeverity.critical, color: 'var(--critical-border)' },
              { label: 'High', value: detail.bySeverity.high, color: 'var(--high-border)' },
              { label: 'Medium', value: detail.bySeverity.medium, color: 'var(--medium-border)' },
              { label: 'Low', value: detail.bySeverity.low, color: 'var(--low-border)' },
            ].map(({ label, value, color }) => {
              const total = detail.byStatus.open
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{value} <span style={{ color: 'var(--text-subtle)' }}>({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card padding="p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Open Findings by Scanner</h2>
          {Object.keys(detail.byScanner).length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No open findings" />
          ) : (
            <div className="space-y-3">
              {Object.entries(detail.byScanner).sort((a, b) => b[1] - a[1]).map(([scanner, count]) => (
                <div key={scanner} className="flex items-center justify-between">
                  <span className="text-sm uppercase tracking-wide font-mono" style={{ color: 'var(--text-muted)' }}>{scanner}</span>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text)' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Status summary + History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Finding Lifecycle</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Open</span>
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>{detail.byStatus.open}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Resolved</span>
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--success-text)' }}>{detail.byStatus.resolved}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Suppressed</span>
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-subtle)' }}>{detail.byStatus.suppressed}</span>
            </div>
          </div>
        </Card>

        <Card padding="p-5" className="lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Posture History</h2>
          {history.length === 0 ? (
            <EmptyState icon={Activity} title="No history yet" description="Scan and resolution activity will appear here." />
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-md" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--surface-3)' }}>
                    <Activity className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm capitalize" style={{ color: 'var(--text)' }}>{h.action.replace(/_/g, ' ')}</div>
                    {h.resource_name && <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{h.resource_name}</div>}
                  </div>
                  <RelativeTime date={h.created_at} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
