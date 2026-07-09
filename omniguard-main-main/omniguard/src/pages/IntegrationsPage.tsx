import { ModulePage } from './ModulePage'

export function IntegrationsPage() {
  return (
    <ModulePage
      config={{
        title: 'Integrations',
        description: 'Connected enterprise systems, service health, and onboarding state.',
        source: 'integrations',
        defaultSelect: 'id, provider, name, status, created_at, updated_at',
        columns: [
          { key: 'provider', label: 'Provider' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'updated_at', label: 'Updated', render: r => r.updated_at ? new Date(r.updated_at).toLocaleString() : '—' },
        ],
      }}
    />
  )
}
