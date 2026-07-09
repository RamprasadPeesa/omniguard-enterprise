import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useRepositories } from '../hooks/useRepositories'
import { PageHeader, Card, EmptyState, LoadingSpinner, Modal, RelativeTime, SeverityBadge } from '../components/ui'
import { GitBranch, Plus, Play, Trash2, RefreshCw, X, Loader as Loader2 } from 'lucide-react'

export function Repositories() {
  const { currentOrganizationId } = useAuth()
  const { repositories, loading, connect, triggerScan, remove, refetch } = useRepositories(currentOrganizationId)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ provider: 'github', owner: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.owner.trim() || !form.name.trim()) { setError('Owner and name required'); return }
    setSaving(true)
    const full_name = `${form.owner.trim()}/${form.name.trim()}`
    const { error: err } = await connect({ provider: form.provider, owner: form.owner.trim(), name: form.name.trim(), full_name, provider_id: '' })
    setSaving(false)
    if (err) setError(err)
    else { setShowAdd(false); setForm({ provider: 'github', owner: '', name: '' }) }
  }

  const handleScan = async (id: string) => {
    setScanning(id)
    await triggerScan(id, 'full')
    setScanning(null)
  }

  const riskColor = (score: number) =>
    score >= 70 ? 'var(--critical-text)' : score >= 40 ? 'var(--warning-text)' : score >= 20 ? 'var(--medium-text)' : 'var(--success-text)'

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Repositories"
        description={`${repositories.length} connected · scan for secrets, SAST, IaC, and dependencies`}
        actions={
          <div className="flex gap-2">
            <button onClick={refetch} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Connect Repository</button>
          </div>
        }
      />

      {loading ? <LoadingSpinner label="Loading repositories..." /> : (
        repositories.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No repositories connected"
            description="Connect a GitHub, GitLab, or Bitbucket repository to start scanning"
            action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Connect First Repository</button>}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {repositories.map(repo => (
              <Card key={repo.id} padding="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                      <h3 className="text-sm font-mono font-medium truncate" style={{ color: 'var(--text)' }}>{repo.full_name}</h3>
                    </div>
                    {repo.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{repo.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      <span className="badge badge-neutral">{repo.provider}</span>
                      <span className="badge badge-neutral">{repo.visibility}</span>
                      {repo.language && <span>{repo.language}</span>}
                      {repo.last_scan_at && <RelativeTime date={repo.last_scan_at} />}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold font-mono" style={{ color: riskColor(repo.risk_score) }}>{Math.round(repo.risk_score)}</div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>risk</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={() => handleScan(repo.id)} disabled={scanning === repo.id} className="btn-primary btn-sm flex-1 justify-center">
                    {scanning === repo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {scanning === repo.id ? 'Scanning...' : 'Scan Now'}
                  </button>
                  <button onClick={() => remove(repo.id)} className="btn-ghost btn-sm" style={{ color: 'var(--critical-text)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Connect Repository"
        footer={<>
          <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleAdd} disabled={!form.owner.trim() || !form.name.trim() || saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect
          </button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Provider</label>
            <select className="input" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="bitbucket">Bitbucket</option>
              <option value="azure-devops">Azure DevOps</option>
            </select>
          </div>
          <div>
            <label className="label">Owner (username or org)</label>
            <input className="input" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="e.g. your-company" autoFocus />
          </div>
          <div>
            <label className="label">Repository Name</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. api-service" />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--critical-text)' }}>{error}</p>}
        </div>
      </Modal>
    </div>
  )
}
