import { ModulePage } from './ModulePage'

export function Projects() {
  return (
    <ModulePage
      config={{
        title: 'Projects',
        description: 'Cross-repository ownership, delivery context, and project-level security posture.',
        source: 'repositories',
        defaultSelect: 'id, full_name, owner, provider, language, default_branch, created_at',
        columns: [
          { key: 'full_name', label: 'Project', render: r => r.full_name || '—' },
          { key: 'owner', label: 'Owner' },
          { key: 'provider', label: 'Provider' },
          { key: 'language', label: 'Primary Language' },
          { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
        ],
      }}
    />
  )
}
