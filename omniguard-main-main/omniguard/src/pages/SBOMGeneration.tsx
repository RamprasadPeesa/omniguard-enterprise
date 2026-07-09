import { ModulePage } from './ModulePage'

export function SBOMGeneration() {
  return (
    <ModulePage
      config={{
        title: 'SBOM Generation',
        description: 'Generate, track, and download software bill of materials artifacts for release and compliance workflows.',
        source: 'scans',
        defaultSelect: 'id, repository_id, status, summary, created_at',
        columns: [
          { key: 'repository_id', label: 'Repository' },
          { key: 'status', label: 'Status' },
          { key: 'summary', label: 'Contents', render: r => r.summary ? Object.keys(r.summary).join(', ') : '—' },
          { key: 'created_at', label: 'Generated', render: r => new Date(r.created_at).toLocaleString() },
        ],
      }}
    />
  )
}
