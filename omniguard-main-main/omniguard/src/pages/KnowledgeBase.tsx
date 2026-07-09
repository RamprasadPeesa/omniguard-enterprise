import { ModulePage } from './ModulePage'

export function KnowledgeBase() {
  return (
    <ModulePage
      config={{
        title: 'Knowledge Base',
        description: 'Policy-backed organizational knowledge and remediation guidance for engineers and reviewers.',
        source: 'policies',
        defaultSelect: 'id, title, category, status, severity, created_at',
        columns: [
          { key: 'title', label: 'Document', render: r => r.title },
          { key: 'category', label: 'Category' },
          { key: 'severity', label: 'Severity' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
        ],
      }}
    />
  )
}
