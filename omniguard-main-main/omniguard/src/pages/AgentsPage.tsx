import { ModulePage } from './ModulePage'

export function AgentsPage() {
  return (
    <ModulePage
      config={{
        title: 'Agents',
        description: 'Background worker and edge agent health plus execution status.',
        source: 'scans',
        defaultSelect: 'id, status, repository_id, created_at, updated_at',
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'repository_id', label: 'Repository' },
          { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleString() },
        ],
      }}
    />
  )
}
