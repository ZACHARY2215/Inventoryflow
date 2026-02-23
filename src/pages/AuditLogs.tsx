import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn, formatDateTime, exportToCsv } from '@/lib/utils'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import { Shield, Search, ChevronDown, Download } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

export default function AuditLogs() {
  usePageTitle('Audit Logs')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('blast_audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) toast.error(error.message)
    else setLogs(data || [])
    setLoading(false)
  }

  const entities = ['all', ...new Set(logs.map(l => l.entity_type))]
  const actions = ['all', ...new Set(logs.map(l => l.action))]

  const filtered = logs.filter(l => {
    const matchSearch = l.entity_id.includes(search) || (l.action || '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (entityFilter === 'all' || l.entity_type === entityFilter) && (actionFilter === 'all' || l.action === actionFilter)
  })

  useEffect(() => { setPage(1) }, [search, entityFilter, actionFilter])
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const actionColor: Record<string, string> = { INSERT: 'text-success bg-success-light', UPDATE: 'text-info bg-info-light', DELETE: 'text-error bg-error-light' }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-text-cta">Audit Logs</h1><p className="text-sm text-text-secondary mt-1">Immutable record of all system actions</p></div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <button
            onClick={() => exportToCsv('audit_logs', filtered.map(l => ({
              timestamp: formatDateTime(l.created_at), entity: l.entity_type, entity_id: l.entity_id,
              action: l.action, user: l.user_id
            })), [
              { key: 'timestamp', label: 'Timestamp' }, { key: 'entity', label: 'Entity' },
              { key: 'entity_id', label: 'Entity ID' }, { key: 'action', label: 'Action' },
              { key: 'user', label: 'User ID' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" /><input type="text" placeholder="Search by entity ID..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="h-10 px-3 rounded-xl border border-border bg-surface text-sm" value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          {entities.map(e => <option key={e} value={e}>{e === 'all' ? 'All Entities' : e}</option>)}
        </select>
        <select className="h-10 px-3 rounded-xl border border-border bg-surface text-sm" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          {actions.map(a => <option key={a} value={a}>{a === 'all' ? 'All Actions' : a}</option>)}
        </select>
      </div>

      <div className="text-xs text-text-tertiary">{filtered.length} log entries</div>

      <div className="neu-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
        filtered.length === 0 ? <div className="text-center py-16"><Shield className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" /><p className="text-text-secondary font-medium">No audit logs found</p></div> :
        <><div className="divide-y divide-border">
          {paged.map(log => (
            <div key={log.id}>
              <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-alt/50 transition-all duration-200 text-left">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase shrink-0', actionColor[log.action] || 'bg-background-alt text-text-secondary')}>{log.action}</span>
                <span className="text-sm font-medium flex-1 truncate">{log.entity_type}</span>
                <span className="text-xs font-mono text-text-tertiary truncate max-w-[200px]">{log.entity_id}</span>
                <span className="text-xs text-text-tertiary shrink-0">{formatDateTime(log.created_at)}</span>
                <ChevronDown className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', expandedId === log.id && 'rotate-180')} />
              </button>
              {expandedId === log.id && (
                <div className="px-4 pb-4 space-y-2 bg-background-alt/30 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    {log.old_data && <div><p className="text-xs font-medium text-text-secondary mb-1">Before</p><pre className="text-xs font-mono bg-error-light p-3 rounded-lg overflow-x-auto max-h-48">{JSON.stringify(log.old_data, null, 2)}</pre></div>}
                    {log.new_data && <div><p className="text-xs font-medium text-text-secondary mb-1">After</p><pre className="text-xs font-mono bg-success-light p-3 rounded-lg overflow-x-auto max-h-48">{JSON.stringify(log.new_data, null, 2)}</pre></div>}
                  </div>
                  <div className="text-xs text-text-tertiary">User: {log.user_id || 'System'} {log.ip_address && `· IP: ${log.ip_address}`}</div>
                </div>
              )}
            </div>
          ))}
        </div>
        <Pagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
        </>}
      </div>
    </div>
  )
}
