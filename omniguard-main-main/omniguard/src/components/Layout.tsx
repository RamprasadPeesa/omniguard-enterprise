import { useState, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useNotifications } from '../hooks/useRepositories'
import { supabase } from '../lib/supabase'
import { Shield, LayoutDashboard, GitBranch, TriangleAlert as AlertTriangle, Play, FileText, Settings, LogOut, Bell, X, ChevronDown, ChevronRight, Search, Building2, Users, Key, BookOpen, Command, Menu, Moon, Sun, Cloud, Cpu, Webhook, Activity, ChartBar as BarChart3, Target, Crown, CircleCheck as CheckCircle2 } from 'lucide-react'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  badge?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Each link points to a UNIQUE page component — no redirects, no duplicates.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/app', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/app/security-posture', icon: Shield, label: 'Security Posture' },
      { to: '/app/attack-surface', icon: Target, label: 'Attack Surface' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { to: '/app/organizations', icon: Building2, label: 'Organizations' },
      { to: '/app/repositories', icon: GitBranch, label: 'Repositories' },
      { to: '/app/cloud-assets', icon: Cloud, label: 'Cloud Assets' },
    ],
  },
  {
    label: 'Security',
    items: [
      { to: '/app/findings', icon: AlertTriangle, label: 'Findings' },
      { to: '/app/scans', icon: Play, label: 'Scans' },
      { to: '/app/policies', icon: FileText, label: 'Policies' },
      { to: '/app/compliance', icon: Shield, label: 'Compliance' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/app/ai-center', icon: Cpu, label: 'AI Center' },
      { to: '/app/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
    ],
  },
  {
    label: 'Team',
    items: [
      { to: '/app/teams', icon: Users, label: 'Teams' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { to: '/app/integrations', icon: Cloud, label: 'Integrations' },
      { to: '/app/webhooks', icon: Webhook, label: 'Webhooks' },
      { to: '/app/api-keys', icon: Key, label: 'API Keys' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/app/audit-logs', icon: Activity, label: 'Audit Logs' },
      { to: '/app/reports', icon: BarChart3, label: 'Reports' },
      { to: '/app/notifications', icon: Bell, label: 'Notifications' },
      { to: '/app/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

function NavItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const isActive = item.to === '/app'
    ? location.pathname === '/app'
    : location.pathname === item.to || location.pathname.startsWith(item.to + '/')

  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded badge badge-info">{item.badge}</span>
      )}
    </NavLink>
  )
}

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const allItems = NAV_GROUPS.flatMap(g => g.items)
  const filtered = query
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : allItems.slice(0, 8)

  useEffect(() => { if (open) setQuery('') }, [open])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
      <div className="relative w-full max-w-lg card-elevated overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search className="w-5 h-5" style={{ color: 'var(--text-subtle)' }} />
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-base outline-none"
            style={{ color: 'var(--text)' }} autoFocus
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-subtle)' }}>
            <Command className="w-3 h-3 inline" />K
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>No results</div>
          ) : filtered.map(item => (
            <button key={item.to} onClick={() => { navigate(item.to); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-[var(--surface-2)]">
              <item.icon className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
              <span className="text-sm" style={{ color: 'var(--text)' }}>{item.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-subtle)' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, memberships, currentOrganizationId, setCurrentOrganizationId, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { notifications, unreadCount, markAllRead } = useNotifications(user?.id || null)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const [orgNames, setOrgNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!memberships.length) return
    supabase.from('organizations').select('id,name').in('id', memberships.map(m => m.organization_id))
      .then(({ data }) => { if (data) setOrgNames(Object.fromEntries(data.map(o => [o.id, o.name]))) })
  }, [memberships])

  // Close menus on route change
  useEffect(() => {
    setShowNotifs(false); setShowOrgMenu(false); setShowUserMenu(false); setMobileOpen(false)
  }, [location.pathname])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if (e.key === 'Escape') { setShowSearch(false); setShowNotifs(false); setShowOrgMenu(false); setShowUserMenu(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const orgs = memberships.map(m => ({ id: m.organization_id, name: orgNames[m.organization_id] || 'Organization', role: m.role }))
  const activeOrg = orgs.find(o => o.id === currentOrganizationId)
  const displayName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : user?.email || 'User'
  const initials = displayName.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 h-14 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Shield className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--accent)' }} />
          {!collapsed && <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--text)' }}>OmniGuard</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block ml-auto p-1 rounded hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-muted)' }}>
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Org Switcher */}
        {!collapsed && orgs.length > 0 && (
          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="relative">
              <button onClick={() => setShowOrgMenu(!showOrgMenu)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-[var(--surface-2)]"
                style={{ border: '1px solid var(--border)' }}>
                <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>Organization</div>
                  <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{activeOrg?.name || 'Select'}</div>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showOrgMenu ? 'rotate-180' : ''}`} style={{ color: 'var(--text-subtle)' }} />
              </button>
              {showOrgMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 card-elevated overflow-hidden z-50">
                  {orgs.map(o => (
                    <button key={o.id} onClick={() => { setCurrentOrganizationId(o.id); setShowOrgMenu(false) }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: currentOrganizationId === o.id ? 'var(--accent)' : 'var(--text)' }}>
                      <Building2 className="w-4 h-4" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{o.name}</div>
                        <div className="text-xs capitalize" style={{ color: 'var(--text-subtle)' }}>{o.role}</div>
                      </div>
                      {currentOrganizationId === o.id && <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar py-2">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>{group.label}</div>
              )}
              {group.items.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t p-2" style={{ borderColor: 'var(--border)' }}>
          {!collapsed ? (
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors hover:bg-[var(--surface-2)]">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>{initials}</div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{displayName}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{user?.email}</div>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} style={{ color: 'var(--text-subtle)' }} />
              </button>
              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 card-elevated overflow-hidden z-50">
                  <NavLink to="/app/settings" onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--text)' }}>
                    <Settings className="w-4 h-4" /> Settings
                  </NavLink>
                  <button onClick={() => signOut().then(() => navigate('/login'))}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--critical-text)' }}>
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setCollapsed(false)}
              className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>{initials}</button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${collapsed ? 'lg:ml-16' : 'lg:ml-60'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 md:px-6 h-14 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 rounded-md hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-muted)' }}>
            <Menu className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSearch(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 w-64 rounded-md text-sm transition-colors hover:bg-[var(--surface-2)]"
            style={{ border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            <Search className="w-4 h-4" /> <span>Search...</span>
            <kbd className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>⌘K</kbd>
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={toggle} className="p-2 rounded-md transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-muted)' }} title="Toggle theme">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs && unreadCount > 0) markAllRead() }}
                className="relative p-2 rounded-md transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-muted)' }}>
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center" style={{ background: 'var(--critical-border)', color: '#fff' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full mt-1 w-80 card-elevated overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Notifications</span>
                    <button onClick={() => setShowNotifs(false)} className="p-1 rounded hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-subtle)' }}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="max-h-96 overflow-y-auto scrollbar">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>No notifications</div>
                    ) : notifications.slice(0, 20).map(n => (
                      <div key={n.id} className="px-4 py-3 border-b transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{n.title}</p>
                        {n.body && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{n.body}</p>}
                        <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {notifications.length > 0 && (
                    <Link to="/app/notifications" onClick={() => setShowNotifs(false)}
                      className="block text-center text-sm py-2.5 border-t transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}>View all</Link>
                  )}
                </div>
              )}
            </div>

            <Link to="/app/scans" className="hidden md:flex btn-primary btn-sm"><Play className="w-3.5 h-3.5" /> New Scan</Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar">{children}</main>

        <footer className="hidden md:flex items-center justify-between px-6 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <span>OmniGuard v2.0</span><span>·</span>
            <NavLink to="/app/audit-logs" className="hover:text-[var(--text)]">Audit Logs</NavLink>
          </div>
          <div className="flex items-center gap-4">
            <NavLink to="/app/settings" className="hover:text-[var(--text)]">Settings</NavLink>
            <a href="mailto:support@omniguard.io" className="hover:text-[var(--text)]">Support</a>
          </div>
        </footer>
      </div>

      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  )
}
