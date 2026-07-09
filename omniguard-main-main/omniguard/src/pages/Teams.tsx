import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseAuth, Tables } from '../lib/supabase'
import { Users, UserPlus, Trash2, Crown, Shield, X } from 'lucide-react'

type Member = Tables<'organization_members'> & { user_profiles?: Tables<'user_profiles'> | null }

const ROLE_ICON: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3 text-yellow-400" />,
  admin: <Shield className="w-3 h-3 text-blue-400" />,
  developer: <Users className="w-3 h-3 text-slate-400" />,
  viewer: <Users className="w-3 h-3 text-slate-600" />,
}

const API = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

export function Teams() {
  const { currentOrganizationId, user, canManageOrg } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('developer')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const load = async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase
      .from('organization_members')
      .select('*, user_profiles(id, email, first_name, last_name, avatar_url)')
      .eq('organization_id', currentOrganizationId)
      .order('created_at')
    setMembers((data as Member[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentOrganizationId])

  const authHeader = async () => {
    const { data: { session } } = await supabaseAuth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : null
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteMsg('')
    if (!inviteEmail.trim() || !currentOrganizationId) return
    setInviting(true)
    const headers = await authHeader()
    if (!headers) {
      setInviting(false)
      setInviteMsg('Not signed in.')
      return
    }
    const res = await fetch(`${API}/api-v1-members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ organization_id: currentOrganizationId, email: inviteEmail.trim(), role: inviteRole }),
    })
    const json = await res.json().catch(() => ({}))
    setInviting(false)
    if (!res.ok) {
      setInviteMsg(json.error || 'Invite failed')
      return
    }
    setInviteMsg('Member invited!')
    setInviteEmail('')
    await load()
    setTimeout(() => { setShowInvite(false); setInviteMsg('') }, 1200)
  }

  const changeRole = async (memberId: string, newRole: string) => {
    const headers = await authHeader()
    if (!headers) return
    await fetch(`${API}/api-v1-members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: memberId, role: newRole }),
    })
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  const remove = async (memberId: string, uid: string) => {
    if (uid === user?.id && !confirm('Remove yourself from this organization?')) return
    const headers = await authHeader()
    if (!headers) return
    await fetch(`${API}/api-v1-members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: memberId }),
    })
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Teams</h1>
          <p className="text-slate-400 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)} disabled={!canManageOrg} className="btn-primary"><UserPlus className="w-4 h-4" />Add Member</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Member', 'Role', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-slate-400 font-medium text-xs uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const p = m.user_profiles
                const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : m.user_id.slice(0, 8)
                return (
                  <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold">{name.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <p className="text-slate-200 text-sm font-medium">{name}</p>
                          {p?.email && name !== p.email && <p className="text-slate-500 text-xs">{p.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.user_id === user?.id ? (
                        <span className="flex items-center gap-1.5 text-slate-300 text-sm">{ROLE_ICON[m.role]}<span className="capitalize">{m.role}</span><span className="text-slate-600 text-xs">(you)</span></span>
                      ) : (
                        <select value={m.role} onChange={e => changeRole(m.id, e.target.value)} className="input text-xs w-36 py-1" disabled={!canManageOrg}>
                          {['owner', 'admin', 'developer', 'viewer'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${m.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-300'}`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {m.user_id !== user?.id && canManageOrg && (
                        <button onClick={() => remove(m.id, m.user_id)} className="btn-ghost text-red-400 text-xs p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
          <div className="card-elevated p-6 w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Add Team Member</h2>
              <button onClick={() => setShowInvite(false)} className="text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={invite} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" required autoFocus />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="viewer">Viewer - read only</option>
                  <option value="developer">Developer - can scan and view</option>
                  <option value="admin">Admin - full access</option>
                  <option value="owner">Owner - billing + full access</option>
                </select>
              </div>
              {inviteMsg && <div className={`p-3 rounded-lg text-sm ${inviteMsg.includes('!') ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>{inviteMsg}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={inviting || !canManageOrg} className="btn-primary flex-1 justify-center">{inviting ? 'Adding...' : 'Add Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
