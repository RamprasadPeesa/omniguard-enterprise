import { ModulePage } from './ModulePage'

export function CloudAssets() {
  return (
    <ModulePage
      config={{
        title: 'Cloud Assets',
        description: 'Connected cloud resources, detected exposures, and integration status.',
        source: 'integrations',
        defaultSelect: 'id, provider, name, status, created_at, updated_at',
        columns: [
          { key: 'provider', label: 'Provider' },
          { key: 'name', label: 'Asset' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Connected', render: r => new Date(r.created_at).toLocaleString() },
        ],
      }}
    />
  )
}
