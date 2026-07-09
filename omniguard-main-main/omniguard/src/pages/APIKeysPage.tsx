import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseAuth, Tables } from '../lib/supabase'
import { PageHeader, Card, EmptyState, LoadingSpinner, Modal, RelativeTime, StatusBadge } from '../components/ui'
import { Key, Plus, Trash2, Copy, Check, Loader as Loader2, X } from 'lucide-react'

type ApiKey = Tables<'api_keys'>

const API = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

export function APIKeysPage() {
  const { currentOrganizationId, canManageOrg } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['scans:read', 'scans:write', 'findings:read'])
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const { data: { session } } = await supabaseAuth.getSession()
    if (!session) { setLoading(false); return }
    try {
      const res = await fetch(`${API}/api-v1-api-keys`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (res.ok) {
        const json = await res.json()
        setKeys(json.data || [])
      }
    } catch { /* non-fatal */ }
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!name.trim() || !currentOrganizationId) return
    setCreating(true)
    const { data: { session } } = await supabaseAuth.getSession()
    if (!session) { setCreating(false); return }
    try {
      const res = await fetch(`${API}/api-v1-api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: name.trim(), scopes }),
      })
      const json = await res.json()
      if (json.success && json.raw_key) {
        setKeys(prev => [json.data, ...prev])
        setCreatedKey(json.raw_key)
        setName('')
        setShowCreate(false)
      }
    } catch { /* non-fatal */ }
    setCreating(false)
  }

  const revoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    setRevoking(id)
    const { data: { session } } = await supabaseAuth.getSession()
    if (!session) { setRevoking(null); return }
    try {
      await fetch(`${API}/api-v1-api-keys`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k))
    } catch { /* non-fatal */ }
    setRevoking(null)
  }

  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const activeKeys = keys.filter(k => k.is_active)
  const revokedKeys = keys.filter(k => !k.is_active)

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="API Keys"
        description="Manage keys for CLI access, CI/CD pipelines, and external integrations"
        actions={canManageOrg && <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Generate Key</button>}
      />

      {createdKey && (
        <Card padding="p-4" className="mb-4" >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--success-soft)' }}>
              <Check className="w-4 h-4" style={{ color: 'var(--success-text)' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Key generated — copy it now</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This key is shown only once. Store it securely.</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs font-mono p-2 rounded flex-1 break-all" style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>{createdKey}</code>
                <button onClick={() => copy(createdKey)} className="btn-secondary btn-sm">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy</button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="btn-ghost btn-sm mt-2">Dismiss</button>
            </div>
          </div>
        </Card>
      )}

      {loading ? <LoadingSpinner label="Loading API keys..." /> : (
        <>
          {keys.length === 0 ? (
            <EmptyState
              icon={Key}
              title="No API keys"
              description="Generate an API key to authenticate CLI, CI/CD, and external tool access"
              action={canManageOrg && <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> Generate Key</button>}
            />
          ) : (
            <div className="space-y-6">
              {activeKeys.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Active Keys ({activeKeys.length})</h2>
                  <div className="space-y-2">
                    {activeKeys.map(k => (
                      <Card key={k.id} padding="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
                              <Key className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{k.name}</span>
                                <StatusBadge status="active" />
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                                <span className="font-mono">{k.key_prefix}...</span>
                                <span>Scopes: {k.scopes?.join(', ') || 'none'}</span>
                                <RelativeTime date={k.last_used_at} />
                              </div>
                            </div>
                          </div>
                          {canManageOrg && (
                            <button onClick={() => revoke(k.id)} disabled={revoking === k.id} className="btn-ghost btn-sm" style={{ color: 'var(--critical-text)' }}>
                              {revoking === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Revoke
                            </button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {revokedKeys.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Revoked Keys ({revokedKeys.length})</h2>
                  <div className="space-y-2">
                    {revokedKeys.map(k => (
                      <Card key={k.id} padding="p-4" className="opacity-60">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
                            <Key className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{k.name}</span>
                            <span className="ml-2 text-xs font-mono" style={{ color: 'var(--text-subtle)' }}>{k.key_prefix}...</span>
                          </div>
                          <StatusBadge status="inactive" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generate API Key"
        footer={<>
          <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={!name.trim() || creating} className="btn-primary">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generate
          </button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Key Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GitHub Actions CI" autoFocus />
            <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>A descriptive name to identify where this key is used.</p>
          </div>
          <div>
            <label className="label">Scopes</label>
            <div className="space-y-2">
              {['scans:read', 'scans:write', 'findings:read', 'findings:write'].map(s => (
                <label key={s} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                  <input type="checkbox" checked={scopes.includes(s)} onChange={e => setScopes(prev => e.target.checked ? [...new Set([...prev, s])] : prev.filter(x => x !== s))} />
                  <span className="font-mono text-xs">{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
