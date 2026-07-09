import { ReactNode, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp, Search, X, Inbox, Loader as Loader2 } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   OmniGuard Component Library — reusable enterprise primitives
   All components use CSS custom properties (theme-aware) — no hardcoded colors.
   ───────────────────────────────────────────────────────────────────────────── */

// ── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{title}</h1>
        {description && <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// ── Badge ────────────────────────────────────────────────────────────────────
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type StatusKind = 'success' | 'warning' | 'neutral' | 'critical' | 'high' | 'medium' | 'low' | 'info'

export function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || 'info').toLowerCase() as Severity
  return <span className={`badge badge-${['critical','high','medium','low','info'].includes(s) ? s : 'info'}`}>{s.toUpperCase()}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase()
  const map: Record<string, string> = {
    open: 'neutral', active: 'success', completed: 'success', resolved: 'success',
    failed: 'critical', error: 'critical', queued: 'warning', running: 'info',
    pending: 'warning', in_progress: 'info', suppressed: 'neutral',
    false_positive: 'neutral', wont_fix: 'neutral', inactive: 'neutral',
    draft: 'warning', archived: 'neutral',
  }
  const kind = map[normalized] || 'neutral'
  const label = normalized.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return <span className={`badge badge-${kind}`}>{label}</span>
}

// ── Card / StatCard ──────────────────────────────────────────────────────────
export function Card({ children, className = '', padding = 'p-5' }: { children: ReactNode; className?: string; padding?: string }) {
  return <div className={`card ${padding} ${className}`}>{children}</div>
}

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>

export function StatCard({ label, value, sublabel, icon: Icon, trend }: {
  label: string; value: string | number; sublabel?: string; icon?: IconType; trend?: { value: string; direction: 'up' | 'down' | 'flat' }
}) {
  return (
    <Card padding="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-2xl font-semibold mt-2 font-mono" style={{ color: 'var(--text)' }}>{value}</p>
          {sublabel && <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{sublabel}</p>}
        </div>
        {Icon && <Icon className="w-5 h-5" style={{ color: 'var(--text-subtle)' }} />}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend.direction === 'up' && <ChevronUp className="w-3 h-3" style={{ color: 'var(--success-text)' }} />}
          {trend.direction === 'down' && <ChevronDown className="w-3 h-3" style={{ color: 'var(--critical-text)' }} />}
          <span style={{ color: 'var(--text-muted)' }}>{trend.value}</span>
        </div>
      )}
    </Card>
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title, description, action }: {
  icon?: IconType; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--surface-2)' }}>
        <Icon className="w-6 h-6" style={{ color: 'var(--text-subtle)' }} />
      </div>
      <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
      {description && <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── LoadingSpinner / SkeletonTable ───────────────────────────────────────────
// ── LoadingSpinner / SkeletonTable ───────────────────────────────────────────
export function LoadingSpinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12">
      <Loader2 className="animate-spin" style={{ width: size, height: size, color: 'var(--accent)' }} />
      {label && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>}
    </div>
  )
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton h-4 flex-1" style={{ maxWidth: `${100 / cols}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── SearchInput ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
      <input className="input pl-9 pr-9" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ── DataTable ────────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'right' | 'center'
}

export function DataTable<T extends { id?: string }>({
  columns, rows, loading, emptyState, onRowClick, rowKey,
}: {
  columns: Column<T>[]; rows: T[]; loading?: boolean; emptyState?: ReactNode;
  onRowClick?: (row: T) => void; rowKey?: (row: T) => string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sortable) return rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey]
      const bv = (b as Record<string, unknown>)[sortKey]
      if (av == null) return 1; if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [rows, sortKey, sortDir, columns])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
                  {col.sortable ? (
                    <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors">
                      {col.label}
                      <ChevronsUpDown className="w-3 h-3" style={{ color: sortKey === col.key ? 'var(--accent)' : 'var(--text-subtle)' }} />
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length}><SkeletonTable rows={5} cols={columns.length} /></td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={columns.length}>{emptyState || <EmptyState title="No records found" />}</td></tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row) : (row.id || i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ id: T; label: string; count?: number }>; active: T; onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          style={{
            borderColor: active === tab.id ? 'var(--accent)' : 'transparent',
            color: active === tab.id ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!open) return null
  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md'
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
      <div className={`relative w-full ${maxW} card-elevated animate-slide-up`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)' }}>{footer}</div>}
      </div>
    </div>
  )
}

// ── RelativeTime ─────────────────────────────────────────────────────────────
export function RelativeTime({ date }: { date: string | null | undefined }) {
  if (!date) return <span style={{ color: 'var(--text-subtle)' }}>—</span>
  const d = new Date(date)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  let label: string
  if (diff < 60) label = 'just now'
  else if (diff < 3600) label = `${Math.floor(diff / 60)}m ago`
  else if (diff < 86400) label = `${Math.floor(diff / 3600)}h ago`
  else if (diff < 604800) label = `${Math.floor(diff / 86400)}d ago`
  else label = d.toLocaleDateString()
  return <span className="text-xs font-mono" style={{ color: 'var(--text-subtle)' }} title={d.toLocaleString()}>{label}</span>
}

// ── CodeBlock ────────────────────────────────────────────────────────────────
export function CodeBlock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <pre className={`p-3 rounded text-xs font-mono overflow-x-auto scrollbar ${className}`}
      style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
      {children}
    </pre>
  )
}
