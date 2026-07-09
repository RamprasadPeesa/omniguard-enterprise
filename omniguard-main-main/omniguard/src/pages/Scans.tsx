import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllScans } from '../hooks/useRepositories'
import { PageHeader, StatCard, EmptyState, LoadingSpinner, RelativeTime, StatusBadge, Tabs } from '../components/ui'
import { Play, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Clock, RefreshCw, GitBranch, Calendar } from 'lucide-react'

const STATUS_META: Record<string, { icon: any; color: string }> = {
  completed: { icon: CheckCircle2, color: 'var(--success-text)' },
  failed: { icon: AlertCircle, color: 'var(--critical-text)' },
  running: { icon: RefreshCw, color: 'var(--accent)' },
  queued: { icon: Clock, color: 'var(--warning-text)' },
}

export function Scans() {
  const { currentOrganizationId } = useAuth()
  const { scans, loading } = useAllScans(currentOrganizationId)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => ({
    queued: scans.filter(s => s.status === 'queued').length,
    running: scans.filter(s => s.status === 'running').length,
    completed: scans.filter(s => s.status === 'completed').length,
    failed: scans.filter(s => s.status === 'failed').length,
  }), [scans])

  const TABS = [
    { id: '', label: 'All', count: scans.length },
    { id: 'queued', label: 'Queued', count: counts.queued },
    { id: 'running', label: 'Running', count: counts.running },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'failed', label: 'Failed', count: counts.failed },
  ]

  const filtered = useMemo(() => {
    return scans
      .filter(s => !statusFilter || s.status === statusFilter)
      .filter(s => !search || (s.repository_name || '').toLowerCase().includes(search.toLowerCase()) || s.branch?.toLowerCase().includes(search.toLowerCase()))
  }, [scans, statusFilter, search])

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Scan History" description={`${scans.length} total scans · real-time updates`} />

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Queued" value={counts.queued} icon={Clock} />
        <StatCard label="Running" value={counts.running} icon={RefreshCw} />
        <StatCard label="Completed" value={counts.completed} icon={CheckCircle2} />
        <StatCard label="Failed" value={counts.failed} icon={AlertCircle} />
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <Tabs tabs={TABS as any} active={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <input className="input w-64" placeholder="Search by repository or branch..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <LoadingSpinner label="Loading scans..." /> : (
        filtered.length === 0 ? (
          <EmptyState
            icon={Play}
            title="No scans yet"
            description="Connect a repository and trigger a scan to see results here"
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Status</th>
                    <th>Trigger</th>
                    <th>Branch</th>
                    <th>Findings</th>
                    <th>Duration</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(scan => {
                    const sum = scan.summary as Record<string, number> | null
                    const meta = STATUS_META[scan.status] || STATUS_META.queued
                    const Icon = meta.icon
                    return (
                      <tr key={scan.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                            <span className="text-sm font-mono" style={{ color: 'var(--text)' }}>{scan.repository_name || scan.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-4 h-4 ${scan.status === 'running' ? 'animate-spin' : ''}`} style={{ color: meta.color }} />
                            <span className="text-xs" style={{ color: meta.color }}>{scan.status}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral text-xs">{scan.trigger}</span>
                        </td>
                        <td>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{scan.branch || 'main'}</span>
                        </td>
                        <td>
                          {sum?.total != null ? (
                            <span className="text-sm font-mono font-semibold" style={{ color: (sum.critical || 0) > 0 ? 'var(--critical-text)' : 'var(--text)' }}>
                              {sum.total}
                              {(sum.critical || 0) > 0 && <span className="text-xs ml-1" style={{ color: 'var(--critical-text)' }}>({sum.critical} crit)</span>}
                            </span>
                          ) : scan.status === 'completed' ? (
                            <span className="text-xs" style={{ color: 'var(--success-text)' }}>clean</span>
                          ) : (
                            <span style={{ color: 'var(--text-subtle)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{scan.duration_seconds ? `${scan.duration_seconds}s` : '—'}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />
                            <RelativeTime date={scan.created_at} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
