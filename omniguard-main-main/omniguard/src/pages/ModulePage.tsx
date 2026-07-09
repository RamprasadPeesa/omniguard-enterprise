import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Search, RefreshCw, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

type Column = { key: string; label: string; render?: (row: any) => React.ReactNode }
type ModuleConfig = {
  title: string
  description: string
  source: string
  columns: Column[]
  defaultSelect?: string
  rowActions?: (row: any) => React.ReactNode
  emptyTitle?: string
  emptyBody?: string
}

export function ModulePage({ config }: { config: ModuleConfig }) {
  const { currentOrganizationId } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(config.columns[0]?.key || 'created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    const load = async () => {
      if (!currentOrganizationId) return
      setLoading(true)
      const select = config.defaultSelect || config.columns.map(c => c.key).join(', ')
      const { data } = await supabase.from(config.source).select(select).eq('organization_id', currentOrganizationId).order(sortKey, { ascending: sortDir === 'asc' }).limit(200)
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [currentOrganizationId, config.source, config.defaultSelect, sortKey, sortDir])

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    const next = text ? rows.filter(row => JSON.stringify(row).toLowerCase().includes(text)) : rows
    return next
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{config.source}</p>
          <h1 className="text-3xl font-bold text-slate-950 mt-2">{config.title}</h1>
          <p className="text-slate-600 mt-1 max-w-3xl">{config.description}</p>
        </div>
        <button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />{sortDir === 'asc' ? 'Oldest first' : 'Newest first'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5"><p className="text-3xl font-bold text-slate-950">{rows.length}</p><p className="text-sm text-slate-600">Total records</p></div>
        <div className="card p-5"><p className="text-3xl font-bold text-slate-950">{filtered.length}</p><p className="text-sm text-slate-600">Matched filters</p></div>
        <div className="card p-5"><p className="text-3xl font-bold text-slate-950">{totalPages}</p><p className="text-sm text-slate-600">Pages</p></div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder={`Search ${config.title.toLowerCase()}...`} value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
          </div>
          <button className="btn-secondary"><Filter className="w-4 h-4" />Filter</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {config.columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{col.label}</th>
              ))}
              {config.rowActions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={config.columns.length + (config.rowActions ? 1 : 0)} className="p-8 text-slate-500">Loading...</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={config.columns.length + (config.rowActions ? 1 : 0)} className="p-12 text-center">
                <div className="text-slate-900 font-medium">{config.emptyTitle || 'No records yet'}</div>
                <div className="text-slate-600 text-sm mt-1">{config.emptyBody || 'Connect data sources to populate this module.'}</div>
              </td></tr>
            ) : pageRows.map((row, i) => (
              <tr key={row.id || i} className="border-t border-slate-200 hover:bg-slate-50">
                {config.columns.map(col => <td key={col.key} className="px-4 py-3 text-slate-700 align-top">{col.render ? col.render(row) : String(row[col.key] ?? '—')}</td>)}
                {config.rowActions && <td className="px-4 py-3 text-right">{config.rowActions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>Page {page} of {totalPages}</div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" />Prev</button>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next<ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}
