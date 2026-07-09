import { ModulePage } from './ModulePage'

export function AICenter() {
  return (
    <ModulePage
      config={{
        title: 'AI Center',
        description: 'Provider validation, routing, and usage visibility for model-backed remediation workflows.',
        source: 'ai_provider_configs',
        defaultSelect: 'id, provider, status, model, created_at, updated_at',
        columns: [
          { key: 'provider', label: 'Provider' },
          { key: 'model', label: 'Model' },
          { key: 'status', label: 'Status' },
          { key: 'updated_at', label: 'Updated', render: r => r.updated_at ? new Date(r.updated_at).toLocaleString() : '—' },
        ],
      }}
    />
  )
}
