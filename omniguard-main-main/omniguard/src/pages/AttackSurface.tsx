import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, RelativeTime, DataTable, SearchInput } from '../components/ui'
import { Target, GitBranch, Globe, TriangleAlert as AlertTriangle, Shield } from 'lucide-react'

interface RepoAsset {
  id: string; full_name: string; provider: string; language: string | null; visibility: string
  risk_score: number; last_scan_at: string | null; default_branch: string
}

export function AttackSurface() {
  const { currentOrganizationId } = useAuth()
  const [assets, setAssets] = useState<RepoAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase.from('repositories')
      .select('id, full_name, provider, language, visibility, risk_score, last_scan_at, default_branch')
      .eq('organization_id', currentOrganizationId).is('deleted_at', null)
      .order('risk_score', { ascending: false })
    setAssets((data || []) as RepoAsset[])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const filtered = assets.filter(a => !search || a.full_name.toLowerCase().includes(search.toLowerCase()))
  const weekAgo = Date.now() - 7 * 86400000
  const unscanned = assets.filter(a => !a.last_scan_at || new Date(a.last_scan_at).getTime() < weekAgo).length
  const highRisk = assets.filter(a => a.risk_score >= 70).length
  const publicRepos = assets.filter(a => a.visibility === 'public').length

  const riskColor = (s: number) => s >= 70 ? 'var(--critical-text)' : s >= 40 ? 'var(--warning-text)' : 'var(--success-text)'

  const columns = [
    { key: 'full_name', label: 'Asset', sortable: true, render: (r: RepoAsset) => (
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
        <span className="text-sm font-mono" style={{ color: 'var(--text)' }}>{r.full_name}</span>
      </div>
    )},
    { key: 'provider', label: 'Provider', sortable: true, render: (r: RepoAsset) => <span className="badge badge-neutral">{r.provider}</span> },
    { key: 'language', label: 'Language', render: (r: RepoAsset) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.language || '—'}</span> },
    { key: 'visibility', label: 'Exposure', render: (r: RepoAsset) => (
      <span className="badge" style={{ background: r.visibility === 'public' ? 'var(--warning-soft)' : 'var(--surface-2)', color: r.visibility === 'public' ? 'var(--warning-text)' : 'var(--text-muted)' }}>
        {r.visibility === 'public' ? <Globe className="w-3 h-3 inline mr-1" /> : null}{r.visibility}
      </span>
    )},
    { key: 'risk_score', label: 'Risk', sortable: true, align: 'right' as const, render: (r: RepoAsset) => (
      <span className="text-sm font-bold font-mono" style={{ color: riskColor(r.risk_score) }}>{Math.round(r.risk_score)}</span>
    )},
    { key: 'last_scan_at', label: 'Last Scan', render: (r: RepoAsset) => (
      r.last_scan_at ? <RelativeTime date={r.last_scan_at} /> : <span className="text-xs" style={{ color: 'var(--critical-text)' }}>Never</span>
    )},
  ]

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Attack Surface" description="Repository assets ranked by exposure and risk score" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Assets" value={assets.length} icon={Target} />
        <StatCard label="High Risk" value={highRisk} sublabel="Risk ≥ 70" icon={AlertTriangle} />
        <StatCard label="Public Repos" value={publicRepos} icon={Globe} />
        <StatCard label="Unscanned (7d+)" value={unscanned} icon={Shield} />
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search assets..." className="w-64" />
      </div>

      {loading ? <LoadingSpinner label="Loading attack surface..." /> : (
        filtered.length === 0 ? (
          <EmptyState icon={Target} title="No assets" description="Connect repositories to map your attack surface" />
        ) : (
          <DataTable columns={columns} rows={filtered} rowKey={r => r.id} />
        )
      )}
    </div>
  )
}
