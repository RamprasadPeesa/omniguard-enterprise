import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, EmptyState, LoadingSpinner, RelativeTime, StatusBadge } from '../components/ui'
import { Building2, Plus, RefreshCw, Crown, Shield, Users } from 'lucide-react'

interface OrgRow { id: string; name: string; slug: string; plan: string; created_at: string }
interface MemberRow { id: string; organization_id: string; role: string; status: string; created_at: string; org?: OrgRow }

export function Organizations() {
  const { user, currentOrganizationId, setCurrentOrganizationId, canManageOrg } = useAuth()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [memberships, setMemberships] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: mems }, { data: orgRows }] = await Promise.all([
      supabase.from('organization_members').select('id, organization_id, role, status, created_at').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('organizations').select('id, name, slug, plan, created_at').order('created_at', { ascending: false }),
    ])
    const orgMap = Object.fromEntries((orgRows || []).map(o => [o.id, o]))
    setOrgs((orgRows || []) as OrgRow[])
    setMemberships(((mems || []) as MemberRow[]).map(m => ({ ...m, org: orgMap[m.organization_id] })))
    if (!currentOrganizationId && mems?.length) setCurrentOrganizationId(mems[0].organization_id)
    setLoading(false)
  }, [user, currentOrganizationId, setCurrentOrganizationId])

  useEffect(() => { load() }, [load])

  const createOrg = async () => {
    if (!name.trim() || !user) return
    setCreating(true)
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const { data: org } = await supabase.from('organizations').insert({ name: name.trim(), slug, plan: 'free', settings: {} }).select().single()
    if (org) {
      await supabase.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'owner', status: 'active' })
      await load()
      setCurrentOrganizationId(org.id)
      setName('')
    }
    setCreating(false)
  }

  const roleIcon: Record<string, React.ReactNode> = {
    owner: <Crown className="w-3 h-3" style={{ color: 'var(--warning-text)' }} />,
    admin: <Shield className="w-3 h-3" style={{ color: 'var(--accent)' }} />,
    developer: <Users className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />,
    viewer: <Users className="w-3 h-3" style={{ color: 'var(--text-subtle)' }} />,
  }

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Organizations"
        description="Tenant administration, membership, and plan context"
        actions={<button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>}
      />

      {loading ? <LoadingSpinner label="Loading organizations..." /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Create org */}
          <Card padding="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Create Organization</h2>
            </div>
            <div className="space-y-3">
              <input className="input" placeholder="Organization name" value={name} onChange={e => setName(e.target.value)} />
              <button onClick={createOrg} disabled={creating || !name.trim()} className="btn-primary w-full justify-center">
                {creating ? 'Creating...' : 'Create tenant'}
              </button>
            </div>
          </Card>

          {/* Memberships */}
          <Card padding="p-5" className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Your Memberships ({memberships.length})</h2>
            </div>
            {memberships.length === 0 ? (
              <EmptyState icon={Building2} title="No memberships" description="Create an organization to get started" />
            ) : (
              <div className="space-y-2">
                {memberships.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setCurrentOrganizationId(m.organization_id)}
                    className="w-full text-left p-3 rounded-md transition-colors"
                    style={{
                      background: currentOrganizationId === m.organization_id ? 'var(--accent-soft)' : 'var(--surface-2)',
                      border: currentOrganizationId === m.organization_id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{m.org?.name || m.organization_id}</p>
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{m.org?.slug} · {m.org?.plan}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {roleIcon[m.role]}
                        <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{m.role}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* All orgs (admin view) */}
          {orgs.length > 0 && (
            <Card padding="p-5" className="lg:col-span-3">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>All Organizations ({orgs.length})</h2>
              <div className="overflow-x-auto scrollbar">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Slug</th>
                      <th>Plan</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map(o => (
                      <tr key={o.id}>
                        <td><span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{o.name}</span></td>
                        <td><span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{o.slug}</span></td>
                        <td><span className="badge badge-neutral capitalize">{o.plan}</span></td>
                        <td><RelativeTime date={o.created_at} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
