import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, EmptyState, LoadingSpinner, RelativeTime, SearchInput, Pagination } from '../components/ui'
import { FileText, Search, Layers, User, ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLog {
  id: string; action: string; resource_type: string; resource_name: string | null
  user_id: string | null; created_at: string; metadata: Record<string, unknown>
}

const ACTION_COLORS: Record<string, string> = {
  scan_triggered: 'var(--accent)',
  scan_completed: 'var(--success-text)',
  finding_resolved: 'var(--success-text)',
  finding_suppressed: 'var(--text-subtle)',
  api_key_created: 'var(--warning-text)',
  api_key_revoked: 'var(--critical-text)',
  webhook_received: 'var(--accent)',
  integration_created: 'var(--accent)',
  integration_disconnected: 'var(--critical-text)',
}

export function AuditLogs() {
  const { currentOrganizationId } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase.from('audit_logs')
      .select('id, action, resource_type, resource_name, user_id, created_at, metadata')
      .eq('organization_id', currentOrganizationId)
      .order('created_at', { ascending: false }).range(0, 199)
    setLogs((data || []) as AuditLog[])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const actions = [...new Set(logs.map(l => l.action))].sort()
  const filtered = logs
    .filter(l => !actionFilter || l.action === actionFilter)
    .filter(l => {
      const q = search.toLowerCase()
      return !q || l.action.includes(q) || (l.resource_name || '').toLowerCase().includes(q)
    })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Audit Logs" description={`${logs.length} events · tamper-proof activity record`} />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search events..." className="w-56" />
        <select className="input w-44" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }}>
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        {actionFilter && <button onClick={() => setActionFilter('')} className="btn-ghost text-xs">Clear</button>}
      </div>

      {loading ? <LoadingSpinner label="Loading audit logs..." /> : (
        pageRows.length === 0 ? (
          <EmptyState icon={FileText} title="No audit events" description="Activity will appear here as users interact with the platform" />
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto scrollbar">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(l => (
                      <tr key={l.id}>
                        <td><RelativeTime date={l.created_at} /></td>
                        <td>
                          <span className="text-xs font-mono font-medium" style={{ color: ACTION_COLORS[l.action] || 'var(--text)' }}>
                            {l.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />
                            <span className="badge badge-neutral text-xs">{l.resource_type}</span>
                            {l.resource_name && <span className="text-xs truncate max-w-32" style={{ color: 'var(--text-muted)' }}>{l.resource_name}</span>}
                          </div>
                        </td>
                        <td>
                          {l.user_id ? (
                            <span className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              <User className="w-3 h-3" />{l.user_id.slice(0, 8)}...
                            </span>
                          ) : <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>System</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )
      )}
    </div>
  )
}
