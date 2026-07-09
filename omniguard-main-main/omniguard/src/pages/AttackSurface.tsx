import { ModulePage } from './ModulePage'

export function AttackSurface() {
  return (
    <ModulePage
      config={{
        title: 'Attack Surface',
        description: 'Repository and cloud asset inventory with exposure context, scan recency, and ownership visibility.',
        source: 'repositories',
        defaultSelect: 'id, full_name, provider, language, default_branch, visibility, risk_score, last_scan_at, created_at',
        columns: [
          { key: 'full_name', label: 'Asset', render: r => r.full_name || r.name || '—' },
          { key: 'provider', label: 'Provider' },
          { key: 'language', label: 'Language' },
          { key: 'visibility', label: 'Visibility' },
          { key: 'last_scan_at', label: 'Last Scan', render: r => r.last_scan_at ? new Date(r.last_scan_at).toLocaleString() : 'Never' },
        ],
      }}
    />
  )
}
