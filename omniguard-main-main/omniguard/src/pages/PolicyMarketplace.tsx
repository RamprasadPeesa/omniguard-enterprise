import { ModulePage } from './ModulePage'

export function PolicyMarketplace() {
  return (
    <ModulePage
      config={{
        title: 'Policy Marketplace',
        description: 'Reusable policy modules and internal standards available for adoption across teams.',
        source: 'policies',
        defaultSelect: 'id, title, severity, status, source_type, created_at',
        columns: [
          { key: 'title', label: 'Policy', render: r => r.title },
          { key: 'severity', label: 'Severity' },
          { key: 'status', label: 'Status' },
          { key: 'source_type', label: 'Source' },
          { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
        ],
      }}
    />
  )
}
