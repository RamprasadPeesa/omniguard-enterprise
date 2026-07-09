import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { PageHeader, Card, StatCard, LoadingSpinner } from '../components/ui'
import { ShieldCheck, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, TrendingUp } from 'lucide-react'

const FRAMEWORKS = [
  { id: 'soc2', name: 'SOC 2 Type II', desc: 'Security, Availability, Confidentiality', controls: 64 },
  { id: 'iso27001', name: 'ISO 27001:2022', desc: 'Information Security Management', controls: 93 },
  { id: 'pci-dss', name: 'PCI DSS v4.0', desc: 'Payment Card Industry', controls: 12 },
  { id: 'hipaa', name: 'HIPAA', desc: 'Health Insurance Portability', controls: 18 },
  { id: 'owasp-asvs', name: 'OWASP ASVS 4.0', desc: 'Application Security Verification', controls: 286 },
  { id: 'nist-csf', name: 'NIST CSF 2.0', desc: 'Cybersecurity Framework', controls: 108 },
]

export function Compliance() {
  const { currentOrganizationId } = useAuth()
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, critical: 0, high: 0 })
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentOrganizationId) return
    const { data } = await supabase.from('findings').select('severity, status').eq('organization_id', currentOrganizationId)
    const f = data || []
    const open = f.filter(x => ['open','assigned','in_progress'].includes(x.status))
    setStats({
      total: f.length,
      open: open.length,
      resolved: f.filter(x => x.status === 'resolved').length,
      critical: open.filter(x => x.severity === 'critical').length,
      high: open.filter(x => x.severity === 'high').length,
    })
    setLoading(false)
  }, [currentOrganizationId])

  useEffect(() => { load() }, [load])

  const score = () => stats.total === 0 ? 100 : Math.max(0, Math.round(100 - (stats.critical * 10 + stats.high * 3 + stats.open * 0.5)))
  const overall = Math.round(FRAMEWORKS.reduce((s, fw) => s + score(), 0) / FRAMEWORKS.length)
  const sc = (n: number) => n >= 80 ? 'var(--success-text)' : n >= 60 ? 'var(--warning-text)' : 'var(--critical-text)'
  const bc = (n: number) => n >= 80 ? 'var(--success-border)' : n >= 60 ? 'var(--warning-border)' : 'var(--critical-border)'

  if (loading) return <div className="p-8"><LoadingSpinner label="Loading compliance..." /></div>

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader title="Compliance" description="Security posture mapped against industry frameworks" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card padding="p-5">
          <p className="text-4xl font-bold font-mono" style={{ color: sc(overall) }}>{overall}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Overall Score</p>
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Across {FRAMEWORKS.length} frameworks</p>
        </Card>
        <StatCard label="Open Issues" value={stats.open} icon={AlertTriangle} />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} />
        <StatCard label="Total" value={stats.total} icon={ShieldCheck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {FRAMEWORKS.map(fw => {
          const s = score()
          return (
            <Card key={fw.id} padding="p-5" className="cursor-pointer transition-all" >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" style={{ color: 'var(--text-subtle)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{fw.name}</h3>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fw.desc}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold font-mono" style={{ color: sc(s) }}>{s}</p>
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>/ 100</p>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${s}%`, background: bc(s) }} />
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <div className="flex gap-3">
                  {stats.critical > 0 && <span style={{ color: 'var(--critical-text)' }}>{stats.critical} critical</span>}
                  {stats.high > 0 && <span style={{ color: 'var(--warning-text)' }}>{stats.high} high</span>}
                  {stats.critical === 0 && stats.high === 0 && <span style={{ color: 'var(--success-text)' }}>No critical issues</span>}
                </div>
                <span style={{ color: 'var(--text-subtle)' }}>{fw.controls} controls</span>
              </div>
            </Card>
          )
        })}
      </div>

      <Card padding="p-4" className="mt-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Improving Your Score</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Resolving critical and high findings raises all framework scores. Suppressing false positives with documented reasons also contributes.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
