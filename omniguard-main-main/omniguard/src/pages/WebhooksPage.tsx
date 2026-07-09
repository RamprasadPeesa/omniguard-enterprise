import { ModulePage } from './ModulePage'

export function WebhooksPage() {
  return (
    <ModulePage
      config={{
        title: 'Webhooks',
        description: 'Outbound event routes for notifications, workflow automation, and integrations.',
        source: 'notifications',
        defaultSelect: 'id, title, body, type, read_at, created_at',
        columns: [
          { key: 'title', label: 'Event' },
          { key: 'type', label: 'Type' },
          { key: 'body', label: 'Payload', render: r => r.body || '—' },
          { key: 'read_at', label: 'Delivered', render: r => r.read_at ? 'Yes' : 'Pending' },
        ],
      }}
    />
  )
}
