import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, SearchInput, RelativeTime, StatusBadge, DataTable } from '../components/ui'
import { BookOpen, FileText, Shield, Search } from 'lucide-react'

interface Policy {
  id: string; title: string; name?: string; category: string | null; severity: string
  status: string; enabled: boolean; enforcement_mode: string; created_at: string
}

export function KnowledgeBase() {
  const { currentOrganizationId } = useAuth()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase.from('policies')
      .select('id, title, name, category, severity, status, enabled, enforcement_mode, created_at')
      .eq('organization_id', currentOrganizationId).is('deleted_at', null)
      .order('created_at', { ascending: false })
    setPolicies((data || []) as Policy[])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const filtered = policies.filter(p => {
    const q = search.toLowerCase()
    return !q || (p.title || p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
  })

  const active = policies.filter(p => p.status === 'active' || p.enabled).length
  const draft = policies.filter(p => p.status === 'draft').length
  const critical = policies.filter(p => p.severity === 'critical').length

  const columns = [
    { key: 'title', label: 'Document', sortable: true, render: (p: Policy) => (
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{p.title || p.name}</span>
      </div>
    )},
    { key: 'category', label: 'Category', render: (p: Policy) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.category || '—'}</span> },
    { key: 'severity', label: 'Severity', render: (p: Policy) => <span className={`badge badge-${p.severity}`}>{p.severity}</span> },
    { key: 'status', label: 'Status', render: (p: Policy) => <StatusBadge status={p.status} /> },
    { key: 'enforcement_mode', label: 'Enforcement', render: (p: Policy) => <span className="badge badge-neutral capitalize">{p.enforcement_mode}</span> },
    { key: 'created_at', label: 'Created', render: (p: Policy) => <RelativeTime date={p.created_at} /> },
  ]

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Knowledge Base" description="Security policies, standards, and governance documents" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Documents" value={policies.length} icon={BookOpen} />
        <StatCard label="Active" value={active} icon={Shield} />
        <StatCard label="Drafts" value={draft} icon={FileText} />
        <StatCard label="Critical Priority" value={critical} icon={Shield} />
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search documents..." className="w-64" />
      </div>

      {loading ? <LoadingSpinner label="Loading knowledge base..." /> : (
        filtered.length === 0 ? (
          <EmptyState icon={BookOpen} title="No documents" description="Create policies or upload documents to build your knowledge base" />
        ) : (
          <DataTable columns={columns} rows={filtered} rowKey={p => p.id} />
        )
      )}
    </div>
  )
}
