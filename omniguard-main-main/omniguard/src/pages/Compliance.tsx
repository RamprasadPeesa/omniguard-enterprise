import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { ShieldCheck, CircleCheck as CheckCircle, CircleAlert as AlertCircle, TrendingUp } from 'lucide-react'

const FW = [
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

  useEffect(() => {
    if (!currentOrganizationId) return
    supabase.from('findings').select('severity, status').eq('organization_id', currentOrganizationId)
      .then(({ data: f }) => {
        const d = f || []
        const open = d.filter(x => ['open', 'assigned', 'in_progress'].includes(x.status))
        setStats({ total: d.length, open: open.length, resolved: d.filter(x => x.status === 'resolved').length, critical: open.filter(x => x.severity === 'critical').length, high: open.filter(x => x.severity === 'high').length })
        setLoading(false)
      })
  }, [currentOrganizationId])

  const score = (_fw: typeof FW[0]) => stats.total === 0 ? 100 : Math.max(0, Math.round(100 - (stats.critical * 10 + stats.high * 3 + stats.open * 0.5)))
  const overall = FW.reduce((s, fw) => s + score(fw), 0) / FW.length
  const sc = (n: number) => n >= 80 ? 'text-emerald-700' : n >= 60 ? 'text-amber-700' : 'text-red-700'
  const bc = (n: number) => n >= 80 ? 'bg-emerald-500' : n >= 60 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Compliance</h1>
        <p className="text-slate-600 mt-1">Security posture mapped against industry frameworks and audit expectations</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5 md:col-span-1">
          <p className={`text-5xl font-bold font-mono ${sc(overall)}`}>{loading ? '—' : Math.round(overall)}</p>
          <p className="text-slate-600 text-sm mt-1">Overall Score</p>
          <p className="text-slate-500 text-xs">Across {FW.length} frameworks</p>
        </div>
        {[
          ['Open Issues', stats.open, 'text-amber-700'],
          ['Resolved', stats.resolved, 'text-emerald-700'],
          ['Total', stats.total, 'text-slate-900'],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="card p-5">
            <p className={`text-3xl font-bold font-mono ${c}`}>{loading ? '—' : v}</p>
            <p className="text-slate-600 text-sm mt-1">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {FW.map(fw => {
          const s = score(fw)
          return (
            <div key={fw.id} className={`card p-5 cursor-pointer hover:border-slate-300 transition-all ${active === fw.id ? 'border-blue-500/30' : ''}`} onClick={() => setActive(active === fw.id ? null : fw.id)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                    <h3 className="text-slate-900 font-semibold">{fw.name}</h3>
                  </div>
                  <p className="text-slate-600 text-sm mt-0.5">{fw.desc}</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold font-mono ${sc(s)}`}>{s}</p>
                  <p className="text-slate-500 text-xs">/ 100</p>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${bc(s)}`} style={{ width: `${s}%` }} />
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="flex gap-4">
                  {stats.critical > 0 && <span className="flex items-center gap-1 text-red-700 text-xs"><AlertCircle className="w-3 h-3" />{stats.critical} critical</span>}
                  {stats.high > 0 && <span className="flex items-center gap-1 text-amber-700 text-xs"><AlertCircle className="w-3 h-3" />{stats.high} high</span>}
                  {stats.critical === 0 && stats.high === 0 && <span className="flex items-center gap-1 text-emerald-700 text-xs"><CheckCircle className="w-3 h-3" />No critical issues</span>}
                </div>
                <span className="text-slate-500 text-xs">{fw.controls} controls</span>
              </div>
              {active === fw.id && (
                <div className="mt-4 pt-4 border-t border-slate-200 animate-fade-in">
                  <p className="text-slate-600 text-sm">{stats.critical > 0 ? `Resolve ${stats.critical} critical finding${stats.critical > 1 ? 's' : ''} to raise your score significantly.` : 'No critical violations for this framework.'}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="card p-4 flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-slate-900 font-medium">Improving Your Score</p>
          <p className="text-slate-600 text-sm mt-1">Resolving critical and high findings raises all framework scores. Suppressing false positives with documented reasons also counts.</p>
        </div>
      </div>
    </div>
  )
}
