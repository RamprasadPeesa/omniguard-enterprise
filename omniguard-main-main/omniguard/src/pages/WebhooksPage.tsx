import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, SearchInput, RelativeTime, DataTable } from '../components/ui'
import { Zap, Webhook, Activity, Bell } from 'lucide-react'

interface WebhookEvent {
  id: string; title: string; type: string; body: string | null
  read_at: string | null; created_at: string
}

export function WebhooksPage() {
  const { currentOrganizationId, user } = useAuth()
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!currentOrganizationId || !user) return
    setLoading(true)
    const { data } = await supabase.from('notifications')
      .select('id, title, body, type, read_at, created_at')
      .eq('organization_id', currentOrganizationId)
      .order('created_at', { ascending: false }).limit(100)
    setEvents((data || []) as WebhookEvent[])
    setLoading(false)
  }, [currentOrganizationId, user])

  useEffect(() => { load() }, [load])

  const filtered = events.filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.type.toLowerCase().includes(search.toLowerCase()))
  const delivered = events.filter(e => e.read_at).length
  const pending = events.length - delivered

  const columns = [
    { key: 'title', label: 'Event', sortable: true, render: (e: WebhookEvent) => (
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.title}</span>
    )},
    { key: 'type', label: 'Type', render: (e: WebhookEvent) => <span className="badge badge-neutral text-xs">{e.type}</span> },
    { key: 'body', label: 'Payload', render: (e: WebhookEvent) => <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{e.body || '—'}</span> },
    { key: 'read_at', label: 'Status', render: (e: WebhookEvent) => (
      <span className="badge" style={{ background: e.read_at ? 'var(--success-soft)' : 'var(--warning-soft)', color: e.read_at ? 'var(--success-text)' : 'var(--warning-text)' }}>
        {e.read_at ? 'Delivered' : 'Pending'}
      </span>
    )},
    { key: 'created_at', label: 'Sent', render: (e: WebhookEvent) => <RelativeTime date={e.created_at} /> },
  ]

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Webhooks" description="Outbound notification events and delivery status" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Events" value={events.length} icon={Webhook} />
        <StatCard label="Delivered" value={delivered} icon={Activity} />
        <StatCard label="Pending" value={pending} icon={Bell} />
        <StatCard label="Event Types" value={new Set(events.map(e => e.type)).size} icon={Zap} />
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search events..." className="w-64" />
      </div>

      {loading ? <LoadingSpinner label="Loading webhooks..." /> : (
        filtered.length === 0 ? (
          <EmptyState icon={Webhook} title="No webhook events" description="Configure webhooks in Settings to receive event notifications" />
        ) : (
          <DataTable columns={columns} rows={filtered} rowKey={e => e.id} />
        )
      )}
    </div>
  )
}
