import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseAuth, Tables } from '../lib/supabase'
import { PageHeader, Card, EmptyState, LoadingSpinner, Modal, StatusBadge, RelativeTime } from '../components/ui'
import { Users, UserPlus, Trash2, Crown, Shield, X, Loader as Loader2 } from 'lucide-react'

type Member = Tables<'organization_members'> & { user_profiles?: { id: string; email: string; first_name: string | null; last_name: string | null } | null }

const API = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

export function Teams() {
  const { currentOrganizationId, user, canManageOrg } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('developer')
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase.from('organization_members')
      .select('*, user_profiles(id, email, first_name, last_name)')
      .eq('organization_id', currentOrganizationId).order('created_at')
    setMembers((data as Member[]) || [])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (!email.trim()) return
    setInviting(true)
    const { data: { session } } = await supabaseAuth.getSession()
    if (!session) { setInviting(false); return }
    try {
      const res = await fetch(`${API}/api-v1-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ organization_id: currentOrganizationId, email: email.trim(), role }),
      })
      const json = await res.json()
      if (res.ok) {
        setMsg('Member added successfully')
        setEmail('')
        await load()
        setTimeout(() => { setShowInvite(false); setMsg('') }, 1200)
      } else {
        setMsg(json.error || 'Failed to add member')
      }
    } catch (err) { setMsg(String(err)) }
    setInviting(false)
  }

  const changeRole = async (memberId: string, newRole: string) => {
    setChangingRole(memberId)
    const { data: { session } } = await supabaseAuth.getSession()
    if (!session) { setChangingRole(null); return }
    await fetch(`${API}/api-v1-members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: memberId, role: newRole }),
    })
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    setChangingRole(null)
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return
    const { data: { session } } = await supabaseAuth.getSession()
    if (!session) return
    await fetch(`${API}/api-v1-members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: memberId }),
    })
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const roleIcon: Record<string, React.ReactNode> = {
    owner: <Crown className="w-3 h-3" style={{ color: 'var(--warning-text)' }} />,
    admin: <Shield className="w-3 h-3" style={{ color: 'var(--accent)' }} />,
  }

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Teams"
        description={`${members.length} member${members.length !== 1 ? 's' : ''}`}
        actions={canManageOrg && <button onClick={() => setShowInvite(true)} className="btn-primary"><UserPlus className="w-4 h-4" /> Add Member</button>}
      />

      {loading ? <LoadingSpinner label="Loading members..." /> : (
        members.length === 0 ? (
          <EmptyState icon={Users} title="No members" />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    {canManageOrg && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const p = m.user_profiles
                    const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : m.user_id.slice(0, 8)
                    const isSelf = m.user_id === user?.id
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{name}{isSelf && <span className="text-xs ml-1" style={{ color: 'var(--text-subtle)' }}>(you)</span>}</p>
                              {p?.email && name !== p.email && <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{p.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td>
                          {isSelf ? (
                            <span className="flex items-center gap-1.5 text-sm capitalize" style={{ color: 'var(--text)' }}>
                              {roleIcon[m.role]}{m.role}
                            </span>
                          ) : canManageOrg ? (
                            <select value={m.role} onChange={e => changeRole(m.id, e.target.value)} disabled={changingRole === m.id} className="input text-xs w-32 py-1">
                              {['owner','admin','engineer','developer','auditor'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                            </select>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{roleIcon[m.role]}{m.role}</span>
                          )}
                        </td>
                        <td><StatusBadge status={m.status} /></td>
                        <td><RelativeTime date={m.created_at} /></td>
                        {canManageOrg && (
                          <td>
                            {!isSelf && <button onClick={() => removeMember(m.id)} className="btn-ghost btn-sm" style={{ color: 'var(--critical-text)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Add Team Member"
        footer={<>
          <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
          <button onClick={invite} disabled={!email.trim() || inviting} className="btn-primary">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Add Member
          </button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" autoFocus />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="viewer">Viewer — read only</option>
              <option value="developer">Developer — can scan and view</option>
              <option value="engineer">Engineer — manage repos and scans</option>
              <option value="admin">Admin — full access</option>
              <option value="owner">Owner — billing + full access</option>
            </select>
          </div>
          {msg && <p className="text-sm" style={{ color: msg.includes('success') ? 'var(--success-text)' : 'var(--critical-text)' }}>{msg}</p>}
        </div>
      </Modal>
    </div>
  )
}
