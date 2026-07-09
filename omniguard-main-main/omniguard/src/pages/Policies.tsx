import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseAuth, Tables } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, Modal, StatusBadge, RelativeTime } from '../components/ui'
import { Shield, Plus, FileText, Trash2, Archive, CircleCheck as CheckCircle2, X, Loader as Loader2 } from 'lucide-react'

type Policy = Tables<'policies'>

const API = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

export function Policies() {
  const { currentOrganizationId, user } = useAuth()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', category: '', description: '', content: '', severity: 'high' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data } = await supabase.from('policies').select('*')
      .eq('organization_id', currentOrganizationId).is('deleted_at', null)
      .order('created_at', { ascending: false })
    setPolicies((data as Policy[]) || [])
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('policies').insert({
      organization_id: currentOrganizationId, created_by: user?.id,
      title: form.title, category: form.category || null, description: form.description || null,
      content: form.content, severity: form.severity, status: 'draft',
      policy_type: 'builtin', enforcement_mode: 'audit', enabled: true,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      setPolicies(prev => [data as Policy, ...prev])
      setShowCreate(false)
      setForm({ title: '', category: '', description: '', content: '', severity: 'high' })
      // Trigger ingestion for embeddings
      const { data: { session } } = await supabaseAuth.getSession()
      if (session) {
        fetch(`${API}/policy-ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ policy_id: data.id, organization_id: currentOrganizationId }),
        }).catch(() => {})
      }
    }
  }

  const activate = async (id: string) => {
    await supabase.from('policies').update({ status: 'active', approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', id)
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, status: 'active' as const } : p))
  }

  const archive = async (id: string) => {
    await supabase.from('policies').update({ status: 'archived' }).eq('id', id)
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' as const } : p))
  }

  const del = async (id: string) => {
    if (!confirm('Delete this policy?')) return
    await supabase.from('policies').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setPolicies(prev => prev.filter(p => p.id !== id))
  }

  const active = policies.filter(p => p.status === 'active').length
  const draft = policies.filter(p => p.status === 'draft').length
  const archived = policies.filter(p => p.status === 'archived').length

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Security Policies"
        description="Governance rules enforced across repositories and scans"
        actions={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Policy</button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Active" value={active} icon={CheckCircle2} />
        <StatCard label="Drafts" value={draft} icon={FileText} />
        <StatCard label="Archived" value={archived} icon={Archive} />
      </div>

      {loading ? <LoadingSpinner label="Loading policies..." /> : (
        policies.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No policies"
            description="Create security policies to enforce standards across your codebase"
            action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Policy</button>}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {policies.map(p => (
              <Card key={p.id} padding="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>{p.title}</h3>
                        <StatusBadge status={p.status} />
                        <span className={`badge badge-${p.severity}`}>{p.severity}</span>
                      </div>
                      {p.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <RelativeTime date={p.created_at} />
                        {p.category && <span className="badge badge-neutral text-xs">{p.category}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  {p.status === 'draft' && <button onClick={() => activate(p.id)} className="btn-primary btn-sm"><CheckCircle2 className="w-3.5 h-3.5" /> Activate</button>}
                  {p.status === 'active' && <button onClick={() => archive(p.id)} className="btn-secondary btn-sm"><Archive className="w-3.5 h-3.5" /> Archive</button>}
                  <button onClick={() => del(p.id)} className="btn-ghost btn-sm" style={{ color: 'var(--critical-text)' }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Security Policy"
        size="lg"
        footer={<>
          <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={!form.title.trim() || !form.content.trim() || saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="No Hardcoded Secrets" autoFocus />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Secrets, Access Control" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief summary" />
          </div>
          <div>
            <label className="label">Severity</label>
            <select className="input max-w-xs" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Policy Content</label>
            <textarea className="input font-mono text-sm" rows={6} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="DENY: secrets in source code&#10;ALLOW: environment variables via secrets manager" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
