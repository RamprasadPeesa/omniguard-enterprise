import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, StatusBadge, RelativeTime, SearchInput, DataTable } from '../components/ui'
import { Cloud, Server, Database, GitBranch } from 'lucide-react'

interface Integration {
  id: string; provider: string; status: string; name: string | null
  created_at: string; updated_at: string | null; last_sync_at: string | null
}

export function CloudAssets() {
  const { currentOrganizationId } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [repos, setRepos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const [{ data: ints }, { data: r }] = await Promise.all([
      supabase.from('integrations').select('id, provider, status, name, created_at, updated_at, last_sync_at')
        .eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }),
      supabase.from('repositories').select('id, full_name, provider, risk_score')
        .eq('organization_id', currentOrganizationId).is('deleted_at', null),
    ])
    setIntegrations((ints || []) as Integration[])
    setRepos(r || [])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const filtered = integrations.filter(i => !search || i.provider.toLowerCase().includes(search.toLowerCase()))
  const active = integrations.filter(i => i.status === 'active').length

  const columns = [
    { key: 'provider', label: 'Provider', sortable: true, render: (r: Integration) => (
      <div className="flex items-center gap-2">
        <Cloud className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
        <span className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>{r.provider}</span>
      </div>
    )},
    { key: 'status', label: 'Status', render: (r: Integration) => <StatusBadge status={r.status} /> },
    { key: 'last_sync_at', label: 'Last Sync', render: (r: Integration) => <RelativeTime date={r.last_sync_at} /> },
    { key: 'created_at', label: 'Connected', render: (r: Integration) => <RelativeTime date={r.created_at} /> },
  ]

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Cloud Assets" description="Connected cloud providers, integrations, and repository assets" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Integrations" value={integrations.length} icon={Cloud} />
        <StatCard label="Active" value={active} icon={Server} />
        <StatCard label="Repositories" value={repos.length} icon={GitBranch} />
        <StatCard label="Providers" value={new Set(integrations.map(i => i.provider)).size} icon={Database} />
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search integrations..." className="w-64" />
      </div>

      {loading ? <LoadingSpinner label="Loading cloud assets..." /> : (
        filtered.length === 0 ? (
          <EmptyState icon={Cloud} title="No cloud integrations" description="Connect cloud providers in Settings to see assets here" />
        ) : (
          <DataTable columns={columns} rows={filtered} rowKey={r => r.id} />
        )
      )}
    </div>
  )
}
