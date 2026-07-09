import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFindings } from '../hooks/useRepositories'
import { PageHeader, SeverityBadge, StatusBadge, SearchInput, EmptyState, LoadingSpinner, Modal, RelativeTime, Pagination, Tabs } from '../components/ui'
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Ban, Sparkles, FileCode, Loader as Loader2, X, ChevronDown } from 'lucide-react'

type Finding = ReturnType<typeof useFindings>['findings'][0]

const SEV_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }

export function Findings() {
  const { currentOrganizationId } = useAuth()
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('open')
  const [scanner, setScanner] = useState('')
  const { findings, loading, totalCount, resolveFinding, suppressFinding, getAIRemediation } = useFindings(
    currentOrganizationId, { severity: severity || undefined, status: status || undefined, scanner: scanner || undefined }
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [expanded, setExpanded] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiTexts, setAiTexts] = useState<Record<string, string>>({})
  const [suppressModal, setSuppressModal] = useState<string | null>(null)
  const [suppressReason, setSuppressReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const TABS = [
    { id: 'open', label: 'Open', count: findings.filter(f => f.status === 'open').length },
    { id: '', label: 'All', count: totalCount },
    { id: 'resolved', label: 'Resolved', count: findings.filter(f => f.status === 'resolved').length },
  ]

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return findings
      .filter(f => !q || f.title.toLowerCase().includes(q) || f.file_path?.toLowerCase().includes(q) || f.rule_id?.includes(q))
      .sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0))
  }, [findings, search])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleResolve = async (id: string) => {
    setActionLoading(id)
    await resolveFinding(id)
    setActionLoading(null)
    setExpanded(null)
  }

  const handleSuppress = async () => {
    if (!suppressModal || !suppressReason.trim()) return
    setActionLoading(suppressModal)
    await suppressFinding(suppressModal, suppressReason)
    setActionLoading(null)
    setSuppressModal(null)
    setSuppressReason('')
    setExpanded(null)
  }

  const handleGetAI = async (id: string) => {
    if (aiTexts[id]) return
    setAiLoading(id)
    const r = await getAIRemediation(id)
    const text = r.ai_remediation || r.remediation || 'No AI remediation available for this finding.'
    setAiTexts(prev => ({ ...prev, [id]: text }))
    setAiLoading(null)
  }

  const counts = {
    critical: findings.filter(f => f.severity === 'critical' && f.status === 'open').length,
    high: findings.filter(f => f.severity === 'high' && f.status === 'open').length,
  }

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Findings"
        description={`${totalCount} total findings${counts.critical > 0 ? ` · ${counts.critical} critical` : ''}${counts.high > 0 ? ` · ${counts.high} high` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {counts.critical > 0 && <span className="badge badge-critical">{counts.critical} Critical</span>}
            {counts.high > 0 && <span className="badge badge-high">{counts.high} High</span>}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search findings..." className="w-64" />
        <select className="input w-36" value={severity} onChange={e => { setSeverity(e.target.value); setPage(1) }}>
          <option value="">All Severities</option>
          {['critical','high','medium','low','info'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="input w-36" value={scanner} onChange={e => { setScanner(e.target.value); setPage(1) }}>
          <option value="">All Scanners</option>
          {['secret','sast','dependency','iac','container'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        {(severity || scanner) && (
          <button onClick={() => { setSeverity(''); setScanner(''); setPage(1) }} className="btn-ghost text-xs">Clear filters <X className="w-3 h-3" /></button>
        )}
      </div>

      {/* Status tabs */}
      <div className="mb-4">
        <Tabs tabs={TABS as any} active={status} onChange={(id) => { setStatus(id); setPage(1) }} />
      </div>

      {loading ? <LoadingSpinner label="Loading findings..." /> : (
        <>
          <div className="space-y-1.5">
            {pageRows.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No findings" description={search ? 'No findings match your search' : 'Run a scan to detect security issues'} />
            ) : pageRows.map(f => (
              <FindingRow
                key={f.id} f={f}
                expanded={expanded === f.id}
                onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
                onResolve={handleResolve}
                onOpenSuppress={() => { setSuppressModal(f.id); setSuppressReason('') }}
                onGetAI={handleGetAI}
                aiText={aiTexts[f.id]}
                aiLoading={aiLoading === f.id}
                actionLoading={actionLoading === f.id}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal open={!!suppressModal} onClose={() => setSuppressModal(null)} title="Suppress Finding" size="sm"
        footer={<>
          <button onClick={() => setSuppressModal(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleSuppress} disabled={!suppressReason.trim() || !!actionLoading} className="btn-danger">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Suppress
          </button>
        </>}>
        <div>
          <label className="label">Reason (required)</label>
          <textarea className="input" rows={3} value={suppressReason} onChange={e => setSuppressReason(e.target.value)} placeholder="Explain why this finding is being suppressed..." autoFocus />
          <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>Suppressions are logged to the audit trail.</p>
        </div>
      </Modal>
    </div>
  )
}

function FindingRow({ f, expanded, onToggle, onResolve, onOpenSuppress, onGetAI, aiText, aiLoading, actionLoading }: {
  f: Finding; expanded: boolean; onToggle: () => void
  onResolve: (id: string) => void; onOpenSuppress: () => void
  onGetAI: (id: string) => void; aiText?: string; aiLoading: boolean; actionLoading: boolean
}) {
  const isResolved = ['resolved','suppressed','false_positive','wont_fix'].includes(f.status)
  return (
    <div
      className="card cursor-pointer transition-all"
      style={{ border: expanded ? '1px solid var(--accent)' : undefined, opacity: isResolved ? 0.6 : 1 }}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3 p-4">
        <SeverityBadge severity={f.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{f.title}</span>
            {isResolved && <StatusBadge status={f.status} />}
            <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{f.rule_id}</span>
          </div>
          {f.file_path && (
            <div className="flex items-center gap-1 mt-1">
              <FileCode className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />
              <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{f.file_path}{f.line_start ? `:${f.line_start}` : ''}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold font-mono" style={{ color: 'var(--text-muted)' }}>{Math.round(f.risk_score || 0)}</span>
          <RelativeTime date={f.created_at} />
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-subtle)' }} />
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4 animate-fade-in" style={{ borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
          {f.description && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{f.description}</p>}

          {f.evidence && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-subtle)' }}>Evidence</p>
              <pre className="p-2.5 rounded text-xs font-mono overflow-x-auto scrollbar" style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>{f.evidence}</pre>
            </div>
          )}

          {(f.owasp?.length > 0 || f.cwe?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {f.owasp?.map(o => <span key={o} className="badge badge-neutral text-[11px]">{o}</span>)}
              {f.cwe?.map(c => <span key={c} className="badge badge-neutral text-[11px]">{c}</span>)}
            </div>
          )}

          {aiText ? (
            <div className="rounded-md p-3.5" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
              <p className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--accent)' }}><Sparkles className="w-3.5 h-3.5" />AI Remediation</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{aiText}</p>
            </div>
          ) : (
            <button onClick={() => onGetAI(f.id)} disabled={aiLoading} className="btn-ghost text-sm flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading ? 'Generating remediation...' : 'Get AI Remediation'}
            </button>
          )}

          {!isResolved && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => onResolve(f.id)} disabled={actionLoading} className="btn-primary btn-sm">
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Resolve
              </button>
              <button onClick={onOpenSuppress} disabled={actionLoading} className="btn-ghost btn-sm">
                <Ban className="w-3.5 h-3.5" /> Suppress
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
