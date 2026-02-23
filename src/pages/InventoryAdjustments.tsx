import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn, formatDateTime, exportToCsv } from '@/lib/utils'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import { ClipboardList, Search, Download, ArrowUp, ArrowDown } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Adjustment {
  id: string
  product_id: string
  adjustment_type: string
  quantity_change: number
  quantity_before: number
  quantity_after: number
  reason: string | null
  batch_reference: string | null
  user_email: string | null
  created_at: string
  blast_products?: { name: string; sku: string } | null
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  damaged: { label: 'Damaged', color: 'bg-error-light text-error' },
  expired: { label: 'Expired', color: 'bg-warning-light text-warning' },
  theft: { label: 'Theft', color: 'bg-error-light text-error' },
  return: { label: 'Return', color: 'bg-info-light text-info' },
  correction: { label: 'Correction', color: 'bg-background-alt text-text-secondary' },
  restock: { label: 'Restock', color: 'bg-success-light text-success' },
  sale: { label: 'Sale', color: 'bg-cta/10 text-cta' },
  transfer: { label: 'Transfer', color: 'bg-info-light text-info' },
  other: { label: 'Other', color: 'bg-background-alt text-text-secondary' },
}

export default function InventoryAdjustments() {
  usePageTitle('Adjustment History')
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('blast_inventory_adjustments')
      .select('*, blast_products(name, sku)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) toast.error(error.message)
    else setAdjustments(data || [])
    setLoading(false)
  }

  const types = ['all', ...new Set(adjustments.map(a => a.adjustment_type))]

  const filtered = adjustments.filter(a => {
    const matchSearch = (a.blast_products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.blast_products?.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.reason || '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (typeFilter === 'all' || a.adjustment_type === typeFilter)
  })

  useEffect(() => { setPage(1) }, [search, typeFilter])
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-cta">Adjustment History</h1>
          <p className="text-sm text-text-secondary mt-1">Track all inventory changes with before/after quantities</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <button
            onClick={() => exportToCsv('adjustments', filtered.map(a => ({
              date: formatDateTime(a.created_at),
              product: a.blast_products?.name || '',
              sku: a.blast_products?.sku || '',
              type: a.adjustment_type,
              change: a.quantity_change,
              before: a.quantity_before,
              after: a.quantity_after,
              reason: a.reason || '',
              user: a.user_email || '',
            })), [
              { key: 'date', label: 'Date' }, { key: 'product', label: 'Product' },
              { key: 'sku', label: 'SKU' }, { key: 'type', label: 'Type' },
              { key: 'change', label: 'Change' }, { key: 'before', label: 'Before' },
              { key: 'after', label: 'After' }, { key: 'reason', label: 'Reason' },
              { key: 'user', label: 'User' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search by product, SKU, or reason..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 px-3 rounded-xl border border-border bg-surface text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : (TYPE_LABELS[t]?.label || t)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="neu-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary font-medium">No adjustments found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-background-alt">
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Product</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-text-secondary">Change</th>
                    <th className="text-right py-3 px-4 font-medium text-text-secondary">Before</th>
                    <th className="text-right py-3 px-4 font-medium text-text-secondary">After</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Reason</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">User</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(a => {
                    const t = TYPE_LABELS[a.adjustment_type] || TYPE_LABELS.other
                    return (
                      <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-background-alt/50 transition-all duration-200">
                        <td className="py-3 px-4 text-xs text-text-secondary whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-sm">{a.blast_products?.name || '—'}</p>
                          <p className="text-xs font-mono text-text-tertiary">{a.blast_products?.sku || ''}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', t.color)}>{t.label}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          <span className={cn('inline-flex items-center gap-0.5', a.quantity_change > 0 ? 'text-success' : 'text-error')}>
                            {a.quantity_change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-text-tertiary">{a.quantity_before}</td>
                        <td className="py-3 px-4 text-right font-mono">{a.quantity_after}</td>
                        <td className="py-3 px-4 text-xs text-text-secondary max-w-[200px] truncate">{a.reason || '—'}</td>
                        <td className="py-3 px-4 text-xs text-text-tertiary">{a.user_email || 'System'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
          </>
        )}
      </div>
    </div>
  )
}
