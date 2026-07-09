import { ModulePage } from './ModulePage'

export function SBOMInventory() {
  return (
    <ModulePage
      config={{
        title: 'SBOM Inventory',
        description: 'Generated software bills of materials and package manifest history for compliance and supply chain review.',
        source: 'scans',
        defaultSelect: 'id, repository_id, status, summary, created_at',
        columns: [
          { key: 'repository_id', label: 'Repository' },
          { key: 'status', label: 'Status' },
          { key: 'summary', label: 'Artifacts', render: r => r.summary ? Object.keys(r.summary).join(', ') : '—' },
          { key: 'created_at', label: 'Generated', render: r => new Date(r.created_at).toLocaleString() },
        ],
      }}
    />
  )
}
