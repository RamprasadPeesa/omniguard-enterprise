import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, Tables } from '../lib/supabase'
import { Bell, CheckCheck, Filter, RefreshCw, Search } from 'lucide-react'

type Notification = Tables<'notifications'>

export function Notifications() {
  const { currentOrganizationId, user } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => items.filter(n => {
    const sev = String((n.data as Record<string, unknown>)?.severity || '')
    const matchSeverity = severity === 'all' || sev === severity || n.type.includes(severity)
    const text = `${n.title} ${n.body || ''} ${n.type}`.toLowerCase()
    return matchSeverity && (!query || text.includes(query.toLowerCase()))
  }), [items, severity, query])

  const load = async () => {
    if (!currentOrganizationId || !user) return
    setLoading(true)
    const { data } = await supabase.from('notifications').select('*').eq('organization_id', currentOrganizationId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(250)
    setItems((data as Notification[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentOrganizationId, user?.id])

  const markAllRead = async () => {
    if (!currentOrganizationId || !user) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('organization_id', currentOrganizationId).eq('user_id', user.id).is('read_at', null)
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in bg-slate-50 min-h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">Live security alerts, scan events, and audit signals.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-sm"><RefreshCw className="w-4 h-4" />Refresh</button>
          <button onClick={markAllRead} className="btn-primary text-sm"><CheckCheck className="w-4 h-4" />Mark all read</button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2">
        <Search className="w-4 h-4 text-slate-500" />
        <input className="input max-w-sm" placeholder="Search notifications..." value={query} onChange={e => setQuery(e.target.value)} />
        <Filter className="w-4 h-4 text-slate-500" />
        {(['all','critical','high','medium','low'] as const).map(s => (
          <button key={s} onClick={() => setSeverity(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${severity === s ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'}`}>
            {s === 'all' ? 'All severities' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-500">Loading notifications...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <h2 className="text-slate-900 font-medium mb-1">No notifications</h2>
          <p className="text-slate-500 text-sm">New scan results, policy events, and delivery failures will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const severityValue = String((n.data as Record<string, unknown>)?.severity || '')
            return (
              <div key={n.id} className={`card p-4 ${!n.read_at ? 'border-slate-400 bg-slate-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-slate-900" />}
                      <h3 className="text-slate-900 font-medium">{n.title}</h3>
                      <span className="badge text-[10px] uppercase tracking-wide bg-slate-100 text-slate-700">{n.type}</span>
                    </div>
                    {n.body && <p className="text-slate-500 text-sm mt-1">{n.body}</p>}
                    <p className="text-slate-400 text-xs mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {severityValue && <span className="badge text-xs bg-slate-100 border border-slate-200 text-slate-700">{severityValue}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
