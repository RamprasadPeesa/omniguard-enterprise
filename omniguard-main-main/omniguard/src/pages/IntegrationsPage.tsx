import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, StatusBadge, RelativeTime, SearchInput, DataTable } from '../components/ui'
import { Layers, Zap, GitBranch, MessageSquare } from 'lucide-react'

interface Integration {
  id: string; provider: string; status: string; name: string | null
  created_at: string; last_sync_at: string | null
}

const PROVIDER_ICONS: Record<string, any> = {
  github: GitBranch, slack: MessageSquare, jira: Layers, teams: MessageSquare,
}

export function IntegrationsPage() {
  const { currentOrganizationId } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase.from('integrations')
      .select('id, provider, status, name, created_at, last_sync_at')
      .eq('organization_id', currentOrganizationId).order('created_at', { ascending: false })
    setIntegrations((data || []) as Integration[])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const filtered = integrations.filter(i => !search || i.provider.toLowerCase().includes(search.toLowerCase()))
  const active = integrations.filter(i => i.status === 'active').length

  const columns = [
    { key: 'provider', label: 'Provider', sortable: true, render: (r: Integration) => {
      const Icon = PROVIDER_ICONS[r.provider] || Layers
      return (
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
          <span className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>{r.provider}</span>
        </div>
      )
    }},
    { key: 'name', label: 'Name', render: (r: Integration) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.name || '—'}</span> },
    { key: 'status', label: 'Status', render: (r: Integration) => <StatusBadge status={r.status} /> },
    { key: 'last_sync_at', label: 'Last Sync', render: (r: Integration) => <RelativeTime date={r.last_sync_at} /> },
    { key: 'created_at', label: 'Connected', render: (r: Integration) => <RelativeTime date={r.created_at} /> },
  ]

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Integrations" description="Connected enterprise services and their sync status" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={integrations.length} icon={Layers} />
        <StatCard label="Active" value={active} icon={Zap} />
        <StatCard label="Providers" value={new Set(integrations.map(i => i.provider)).size} icon={GitBranch} />
        <StatCard label="Errors" value={integrations.filter(i => i.status === 'error').length} icon={MessageSquare} />
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search integrations..." className="w-64" />
      </div>

      {loading ? <LoadingSpinner label="Loading integrations..." /> : (
        filtered.length === 0 ? (
          <EmptyState icon={Layers} title="No integrations" description="Connect services like GitHub, Jira, or Slack in Settings" />
        ) : (
          <DataTable columns={columns} rows={filtered} rowKey={r => r.id} />
        )
      )}
    </div>
  )
}
