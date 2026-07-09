import { useAuth } from '../hooks/useAuth'
import { useDashboardStats, useAllScans } from '../hooks/useRepositories'
import { supabase } from '../lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, StatCard, Card, SeverityBadge, StatusBadge, RelativeTime, LoadingSpinner } from '../components/ui'
import { Shield, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, GitBranch, Play, Activity, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function Dashboard() {
  const { currentOrganizationId, profile } = useAuth()
  const { stats, loading: statsLoading } = useDashboardStats(currentOrganizationId)
  const { scans } = useAllScans(currentOrganizationId)
  const [trendData, setTrendData] = useState<Array<{ date: string; critical: number; high: number; medium: number; total: number }>>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [topRisks, setTopRisks] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    if (!currentOrganizationId) return
    const { data: findings } = await supabase
      .from('findings').select('severity, status, risk_score, title, file_path, line_start, created_at, resolved_at')
      .eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }).limit(500)

    if (findings) {
      const open = findings.filter(f => !['resolved','suppressed','false_positive'].includes(f.status))
        .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5)
      setTopRisks(open)

      const trends: Array<{ date: string; critical: number; high: number; medium: number; total: number }> = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000)
        const dayFindings = findings.filter(f => new Date(f.created_at).toDateString() === date.toDateString())
        trends.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          critical: dayFindings.filter(f => f.severity === 'critical').length,
          high: dayFindings.filter(f => f.severity === 'high').length,
          medium: dayFindings.filter(f => f.severity === 'medium').length,
          total: dayFindings.length,
        })
      }
      setTrendData(trends)
    }

    const { data: auditLogs } = await supabase
      .from('audit_logs').select('id, action, resource_type, resource_name, created_at')
      .eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }).limit(8)
    if (auditLogs) setRecentActivity(auditLogs)
  }, [currentOrganizationId])

  useEffect(() => { fetchData() }, [fetchData])

  const recent = scans.slice(0, 5)
  const openTotal = stats.critical + stats.high + stats.medium + stats.low
  const postureScore = Math.max(0, Math.min(100, 100 - (stats.critical * 15 + stats.high * 5 + stats.medium * 2)))
  const grade = postureScore >= 90 ? 'A' : postureScore >= 80 ? 'B' : postureScore >= 70 ? 'C' : postureScore >= 60 ? 'D' : 'F'

  if (statsLoading) return <div className="p-8"><LoadingSpinner label="Loading dashboard..." /></div>

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title={`Welcome back, ${profile?.first_name || 'User'}`}
        description={`Security overview for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        actions={<Link to="/app/scans" className="btn-primary"><Play className="w-4 h-4" /> New Scan</Link>}
      />

      {/* Posture + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card padding="p-5" className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Security Posture</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-mono" style={{ color: 'var(--text)' }}>{postureScore}</span>
            <span className="text-xl font-semibold" style={{ color: 'var(--accent)' }}>{grade}</span>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {postureScore >= 80 ? 'Strong posture — keep it up' : postureScore >= 60 ? 'Needs attention' : 'Critical risk'}
          </p>
        </Card>
        <StatCard label="Critical" value={stats.critical} sublabel="Open findings" icon={AlertTriangle} />
        <StatCard label="Resolved" value={stats.resolved} sublabel="All time" icon={CheckCircle2} />
        <StatCard label="Repositories" value={stats.repos} sublabel={`Avg risk: ${stats.avgRisk}`} icon={GitBranch} />
      </div>

      {/* Trend + Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card padding="p-5" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Findings Trend (7 days)</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--critical-border)' }} /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--high-border)' }} /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--medium-border)' }} /> Medium</span>
            </div>
          </div>
          <div className="h-44 flex items-end gap-2">
            {trendData.map((day, i) => {
              const maxVal = Math.max(...trendData.map(d => d.critical + d.high + d.medium), 1)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end h-32 gap-0.5">
                    <div className="w-full rounded-t transition-all" style={{ height: `${(day.critical / maxVal) * 100}%`, background: 'var(--critical-border)', minHeight: day.critical ? '4px' : '0' }} />
                    <div className="w-full transition-all" style={{ height: `${(day.high / maxVal) * 100}%`, background: 'var(--high-border)', minHeight: day.high ? '4px' : '0' }} />
                    <div className="w-full rounded-b transition-all" style={{ height: `${(day.medium / maxVal) * 100}%`, background: 'var(--medium-border)', minHeight: day.medium ? '4px' : '0' }} />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{day.date}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card padding="p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>By Severity</h2>
          <div className="space-y-3">
            {[
              { label: 'Critical', value: stats.critical, color: 'var(--critical-border)' },
              { label: 'High', value: stats.high, color: 'var(--high-border)' },
              { label: 'Medium', value: stats.medium, color: 'var(--medium-border)' },
              { label: 'Low', value: stats.low, color: 'var(--low-border)' },
            ].map(({ label, value, color }) => {
              const pct = openTotal > 0 ? Math.round((value / openTotal) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Open</span>
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>{openTotal}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Risks + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Highest Risk Findings</h2>
            <Link to="/app/findings" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all</Link>
          </div>
          {topRisks.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--success-border)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No open findings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topRisks.map((f, i) => (
                <Link key={f.id} to="/app/findings" className="flex items-center gap-3 p-2.5 rounded-md transition-colors hover:bg-[var(--surface-2)]">
                  <span className="text-xs font-bold font-mono w-6" style={{ color: 'var(--text-subtle)' }}>#{i + 1}</span>
                  <SeverityBadge severity={f.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{f.title}</div>
                    <div className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{f.file_path?.split('/').pop()}:{f.line_start}</div>
                  </div>
                  <span className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>{Math.round(f.risk_score || 0)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card padding="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent Activity</h2>
            <Link to="/app/audit-logs" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-md" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--surface-3)' }}>
                    <Activity className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: 'var(--text)' }}>{a.action.replace(/_/g, ' ')}</div>
                    {a.resource_name && <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{a.resource_name}</div>}
                  </div>
                  <RelativeTime date={a.created_at} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Scans */}
      <Card padding="p-5" className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent Scans</h2>
          <Link to="/app/scans" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center">
            <Play className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No scans yet — <Link to="/app/repositories" className="hover:underline" style={{ color: 'var(--accent)' }}>connect a repository</Link></p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(scan => {
              const sum = scan.summary as Record<string, number> | null
              return (
                <Link key={scan.id} to="/app/scans" className="flex items-center gap-3 p-2.5 rounded-md transition-colors hover:bg-[var(--surface-2)]">
                  <StatusBadge status={scan.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{scan.repository_name || 'Unknown repo'}</div>
                    <div className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{scan.branch || 'main'} · {scan.commit_sha?.slice(0, 7)}</div>
                  </div>
                  {sum?.total != null && <span className="text-sm font-mono" style={{ color: sum.critical > 0 ? 'var(--critical-text)' : 'var(--text-muted)' }}>{sum.total}</span>}
                  <RelativeTime date={scan.created_at} />
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
