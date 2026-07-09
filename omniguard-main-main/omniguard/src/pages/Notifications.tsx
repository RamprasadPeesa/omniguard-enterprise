import { useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useRepositories'
import { PageHeader, Card, EmptyState, RelativeTime } from '../components/ui'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'

export function Notifications() {
  const { user } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications(user?.id || null)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 100))
    setRefreshing(false)
  }, [])

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Notifications"
        description={`${notifications.length} total · ${unreadCount} unread`}
        actions={
          <div className="flex gap-2">
            <button onClick={refresh} className="btn-secondary"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
            <button onClick={markAllRead} disabled={unreadCount === 0} className="btn-primary"><CheckCheck className="w-4 h-4" /> Mark all read</button>
          </div>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Security alerts and scan results will appear here" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} padding="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {!n.read_at && <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--accent)' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>{n.title}</h3>
                      <span className="badge badge-neutral text-xs">{n.type}</span>
                    </div>
                    {n.body && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{n.body}</p>}
                    <div className="mt-1"><RelativeTime date={n.created_at} /></div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
