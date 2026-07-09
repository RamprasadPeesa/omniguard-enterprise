import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, EmptyState, LoadingSpinner, RelativeTime } from '../components/ui'
import { Brain, Sparkles, Activity, Zap } from 'lucide-react'

export function AICenter() {
  const { currentOrganizationId } = useAuth()
  const [usage, setUsage] = useState<any[]>([])
  const [orgConfig, setOrgConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    setLoading(true)
    const [{ data: u }, { data: org }] = await Promise.all([
      supabase.from('ai_usage').select('*').eq('organization_id', currentOrganizationId).order('created_at', { ascending: false }).limit(50),
      supabase.from('organizations').select('ai_config').eq('id', currentOrganizationId).maybeSingle(),
    ])
    setUsage(u || [])
    setOrgConfig(org?.ai_config || {})
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const provider = orgConfig?.provider || 'none'
  const totalTokens = usage.reduce((s, u) => s + (u.total_tokens || 0), 0)
  const cacheHits = usage.filter(u => u.cache_hit).length
  const cacheRate = usage.length > 0 ? Math.round((cacheHits / usage.length) * 100) : 0

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="AI Center" description="AI provider configuration, usage, and cost tracking" />

      {/* Provider status */}
      <Card padding="p-5" className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <Brain className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Active Provider</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{provider === 'none' ? 'No provider configured' : provider.charAt(0).toUpperCase() + provider.slice(1)}</p>
            </div>
          </div>
          {orgConfig?.fallback_provider && (
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Fallback</p>
              <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-muted)' }}>{orgConfig.fallback_provider}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Usage stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Calls" value={usage.length} icon={Activity} />
        <StatCard label="Tokens Used" value={totalTokens.toLocaleString()} icon={Zap} />
        <StatCard label="Cache Hit Rate" value={`${cacheRate}%`} icon={Sparkles} />
        <StatCard label="Avg Latency" value={usage.length > 0 ? `${Math.round(usage.reduce((s, u) => s + (u.latency_ms || 0), 0) / usage.length)}ms` : '—'} icon={Activity} />
      </div>

      {/* Usage log */}
      <Card padding="p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Recent AI Calls</h2>
        {loading ? <LoadingSpinner label="Loading usage..." /> : (
          usage.length === 0 ? (
            <EmptyState icon={Brain} title="No AI calls yet" description="Run scans with an AI provider configured to see usage here" />
          ) : (
            <div className="space-y-2">
              {usage.slice(0, 20).map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-md" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{u.model}</span>
                      <span className="badge badge-neutral text-xs">{u.tier}</span>
                      {u.cache_hit && <span className="badge" style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>cached</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                      {u.prompt_tokens || 0} prompt · {u.completion_tokens || 0} completion · {u.latency_ms || 0}ms
                    </div>
                  </div>
                  <RelativeTime date={u.created_at} />
                </div>
              ))}
            </div>
          )
        )}
      </Card>
    </div>
  )
}
