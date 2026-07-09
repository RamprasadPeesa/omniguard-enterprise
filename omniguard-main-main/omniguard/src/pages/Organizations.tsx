import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Building2, Plus, RefreshCw, Shield, Users, Globe, Crown, Search, Filter } from 'lucide-react'

type Org = { id: string; name: string; slug: string; plan: string; created_at: string; updated_at: string; settings?: Record<string, unknown> | null }
type Member = { id: string; organization_id: string; role: string; status: string; created_at: string; org?: Org }

export function Organizations() {
  const { user, currentOrganizationId, setCurrentOrganizationId, canManageOrg } = useAuth()
  const [organizations, setOrganizations] = useState<Org[]>([])
  const [memberships, setMemberships] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [savingOrg, setSavingOrg] = useState<string | null>(null)
  const activeOrg = useMemo(() => organizations.find(o => o.id === currentOrganizationId) || null, [organizations, currentOrganizationId])

  const load = async () => {
    if (!user) return
    setLoading(true)
    const [{ data: mems }, { data: orgs }] = await Promise.all([
      supabase.from('organization_members').select('id, organization_id, role, status, created_at').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('organizations').select('id, name, slug, plan, created_at, updated_at, settings').order('created_at', { ascending: false }),
    ])
    const orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o]))
    setOrganizations((orgs || []) as Org[])
    setMemberships(((mems || []) as Member[]).map(m => ({ ...m, org: orgMap[m.organization_id] })))
    if (!currentOrganizationId && mems?.length) setCurrentOrganizationId(mems[0].organization_id)
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.id])

  const createOrg = async () => {
    if (!name.trim()) return
    setCreating(true)
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const { data: org } = await supabase.from('organizations').insert({ name: name.trim(), slug, plan: 'free', settings: {} }).select().single()
    if (org && user) {
      await supabase.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'owner', status: 'active' })
      await load()
      setCurrentOrganizationId(org.id)
      setName('')
    }
    setCreating(false)
  }

  const updateOrg = async (orgId: string, patch: Partial<Pick<Org, 'name' | 'slug' | 'plan'>>) => {
    if (!canManageOrg) return
    setSavingOrg(orgId)
    await supabase.from('organizations').update(patch).eq('id', orgId)
    await load()
    setSavingOrg(null)
  }

  const visibleOrgs = organizations.filter(o => !query || `${o.name} ${o.slug} ${o.plan}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="p-8 space-y-6 animate-fade-in bg-slate-50 min-h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-500 mt-1">Tenant administration, membership, and billing context</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" />Refresh</button>
          <button onClick={() => setCurrentOrganizationId(activeOrg?.id || memberships[0]?.organization_id || '')} className="btn-primary" disabled={!activeOrg}><Globe className="w-4 h-4" />Set Active</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-slate-700" /><h2 className="text-sm font-semibold text-slate-700">Create Organization</h2></div>
          <div className="space-y-3">
            <input className="input" placeholder="Organization name" value={name} onChange={e => setName(e.target.value)} />
            <button onClick={createOrg} disabled={creating || !name.trim()} className="btn-primary w-full justify-center">{creating ? 'Creating...' : 'Create tenant'}</button>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4"><Building2 className="w-4 h-4 text-slate-700" /><h2 className="text-sm font-semibold text-slate-700">Active Organization</h2></div>
          {activeOrg ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Name</p>
                <input className="input" value={activeOrg.name} onChange={e => setOrganizations(prev => prev.map(o => o.id === activeOrg.id ? { ...o, name: e.target.value } : o))} onBlur={e => updateOrg(activeOrg.id, { name: e.target.value })} disabled={!canManageOrg} />
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Slug</p>
                <input className="input" value={activeOrg.slug} onChange={e => setOrganizations(prev => prev.map(o => o.id === activeOrg.id ? { ...o, slug: e.target.value } : o))} onBlur={e => updateOrg(activeOrg.id, { slug: e.target.value })} disabled={!canManageOrg} />
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Plan</p>
                <select className="input" value={activeOrg.plan} onChange={e => updateOrg(activeOrg.id, { plan: e.target.value })} disabled={!canManageOrg}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Created</p>
                <p className="text-slate-800">{new Date(activeOrg.created_at).toLocaleString()}</p>
              </div>
            </div>
          ) : <p className="text-slate-500">No active organization selected.</p>}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input className="input max-w-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search organizations..." />
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-500">{visibleOrgs.length} visible</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-slate-700" /><h2 className="text-sm font-semibold text-slate-700">Memberships</h2></div>
          <div className="space-y-2">
            {memberships.map(m => (
              <button key={m.id} onClick={() => setCurrentOrganizationId(m.organization_id)} className={`w-full text-left p-3 rounded-lg border transition-colors ${currentOrganizationId === m.organization_id ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-slate-900 font-medium">{m.org?.name || m.organization_id}</p>
                    <p className="text-xs text-slate-500">{m.org?.slug || 'org'} · {m.org?.plan || 'free'}</p>
                  </div>
                  <span className="badge text-xs bg-slate-100 text-slate-700 capitalize">{m.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4"><Shield className="w-4 h-4 text-slate-700" /><h2 className="text-sm font-semibold text-slate-700">Tenant Controls</h2></div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4"><p className="text-xs text-slate-500 uppercase tracking-wide">Organizations</p><p className="text-slate-900 mt-1">{organizations.length}</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4"><p className="text-xs text-slate-500 uppercase tracking-wide">Active members</p><p className="text-slate-900 mt-1">{memberships.length}</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4"><p className="text-xs text-slate-500 uppercase tracking-wide">Selected org</p><p className="text-slate-900 mt-1">{activeOrg?.name || 'None'}</p></div>
          </div>
          <p className="text-slate-500 text-sm mt-4">Member permissions are enforced through Supabase RLS and the API gateway. Admins can switch the active tenant from this page.</p>
        </div>
      </div>
    </div>
  )
}
