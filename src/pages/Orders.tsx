import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, formatDateTime, exportToCsv } from '@/lib/utils'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import CustomSelect from '@/components/CustomSelect'
import {
  ClipboardList, Search, Eye, Plus, Download,
  CheckCircle, Truck, XCircle, Clock, ChevronDown, User, CreditCard, Calendar,
  Trash2,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Order {
  id: string; order_number: string; user_id: string; status: string
  total_amount: number; created_at: string; delivered_at: string | null
  customer_name: string | null; payment_method: string | null
  payment_status: string | null
  discount_type: string | null; discount_value: number | null
}

type SortKey = 'created_at' | 'total_amount' | 'order_number'

export default function Orders() {
  usePageTitle('Orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => { fetchOrders(); fetchUsers() }, [])

  // User name lookup
  const [userMap, setUserMap] = useState<Record<string, string>>({})
  const fetchUsers = async () => {
    const { data } = await supabase.from('blast_users').select('id, display_name, email')
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((u: any) => { map[u.id] = u.display_name || u.email })
      setUserMap(map)
    }
  }

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('blast_orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) toast.error(error.message)
      else setOrders(data || [])
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'order_number') }
  }

  const filtered = orders.filter(o => {
    const matchSearch = o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchDateFrom = !dateFrom || new Date(o.created_at) >= new Date(dateFrom)
    const matchDateTo = !dateTo || new Date(o.created_at) <= new Date(dateTo + 'T23:59:59')
    const matchPayment = paymentFilter === 'all' || o.payment_method === paymentFilter
    const matchCreator = creatorFilter === 'all' || o.user_id === creatorFilter
    return matchSearch && matchStatus && matchDateFrom && matchDateTo && matchPayment && matchCreator
  }).sort((a, b) => {
    const v = sortAsc ? 1 : -1
    if (sortKey === 'order_number') return a.order_number.localeCompare(b.order_number) * v
    if (sortKey === 'total_amount') return (Number(a.total_amount) - Number(b.total_amount)) * v
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * v
  })

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, statusFilter, dateFrom, dateTo, paymentFilter, creatorFilter])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === paged.length) setSelected(new Set())
    else setSelected(new Set(paged.map(o => o.id)))
  }

  const statusCounts = {
    all: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    const draftOnly = [...selected].every(id => orders.find(o => o.id === id)?.status === 'draft')
    if (!draftOnly) { toast.error('Only draft orders can be bulk-deleted'); return }
    const { error } = await supabase.from('blast_orders').delete().in('id', [...selected])
    if (error) toast.error(error.message)
    else { toast.success(`${selected.size} draft order(s) deleted`); setSelected(new Set()); fetchOrders() }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-cta">Orders</h1>
          <p className="text-sm text-text-secondary mt-1">View and manage all orders</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <button
            onClick={() => exportToCsv('orders', filtered.map(o => ({
              order_number: o.order_number, status: o.status, customer: o.customer_name || '',
              payment: o.payment_method || '', total: o.total_amount, date: formatDateTime(o.created_at)
            })), [
              { key: 'order_number', label: 'Order #' }, { key: 'status', label: 'Status' },
              { key: 'customer', label: 'Customer' }, { key: 'payment', label: 'Payment' },
              { key: 'total', label: 'Total' }, { key: 'date', label: 'Date' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <Link to="/pos" className="inline-flex items-center gap-2 px-4 py-2.5 bg-cta hover:bg-cta-dark text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Order
          </Link>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-cta/10 border border-cta-200 rounded-xl text-sm no-print">
          <span className="font-medium text-cta">{selected.size} selected</span>
          <button onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error text-white text-xs font-medium hover:bg-error/90 transition-colors">
            <Trash2 className="w-3 h-3" /> Delete Drafts
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-text-secondary hover:text-text-cta">Clear</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 no-print">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="text" placeholder="Search by order # or customer..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-tertiary" />
            <input
              type="date"
              className="h-10 px-3 rounded-xl border border-border bg-surface text-sm font-sans text-text-primary focus:border-cta focus:ring-2 focus:ring-cta/20 outline-none transition-all cursor-pointer"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
            <span className="text-text-tertiary text-xs">to</span>
            <input
              type="date"
              className="h-10 px-3 rounded-xl border border-border bg-surface text-sm font-sans text-text-primary focus:border-cta focus:ring-2 focus:ring-cta/20 outline-none transition-all cursor-pointer"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-error hover:underline">Clear</button>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'draft', 'confirmed', 'delivered', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn(
              'px-3 py-2 rounded-xl text-sm font-medium transition-colors capitalize',
              statusFilter === s ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt'
            )}>
              {s} ({statusCounts[s]})
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <CustomSelect
            compact
            className="w-[160px]"
            value={paymentFilter}
            onChange={setPaymentFilter}
            placeholder="All Payments"
            options={[
              { value: 'all', label: 'All Payments' },
              { value: 'cash', label: 'Cash' },
              { value: 'credit', label: 'Credit' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'gcash', label: 'GCash' },
            ]}
          />
          <CustomSelect
            compact
            className="w-[200px]"
            value={creatorFilter}
            onChange={setCreatorFilter}
            placeholder="All Users"
            options={[
              { value: 'all', label: 'All Users' },
              ...[...new Set(orders.map(o => o.user_id))].map(uid => ({
                value: uid,
                label: userMap[uid] || uid.slice(0, 8) + '…',
              })),
            ]}
          />
        </div>
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
            <p className="text-text-secondary font-medium">No orders found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-background-alt">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === paged.length && paged.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border accent-cta"
                      />
                    </th>
                    <SortTh label="Order #" sortKey="order_number" current={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Payment</th>
                    <SortTh label="Total" sortKey="total_amount" current={sortKey} asc={sortAsc} onSort={handleSort} />
                    <SortTh label="Date" sortKey="created_at" current={sortKey} asc={sortAsc} onSort={handleSort} />
                    <th className="text-right py-3 px-4 font-medium text-text-secondary no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(o => (
                    <tr key={o.id} className={cn(
                      'border-b border-border/50 last:border-0 hover:bg-background-alt/50 transition-all duration-200',
                      selected.has(o.id) && 'bg-cta/10/50'
                    )}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="w-4 h-4 rounded border-border accent-cta"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-sm font-medium">{o.order_number}</td>
                      <td className="py-3 px-4"><StatusBadge status={o.status} /></td>
                      <td className="py-3 px-4">
                        {o.customer_name ? (
                          <span className="inline-flex items-center gap-1 text-sm"><User className="w-3 h-3 text-text-tertiary" /> {o.customer_name}</span>
                        ) : <span className="text-text-tertiary text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {o.payment_method ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-background-alt"><CreditCard className="w-3 h-3" /> {o.payment_method}</span>
                        ) : <span className="text-text-tertiary text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono">{formatCurrency(Number(o.total_amount))}</td>
                      <td className="py-3 px-4 text-text-secondary text-xs">{formatDateTime(o.created_at)}</td>
                      <td className="py-3 px-4 text-right no-print">
                        <Link to={`/orders/${o.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-background-alt transition-all duration-200 text-text-secondary hover:text-text-cta">
                          <Eye className="w-3 h-3" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function SortTh({ label, sortKey: key, current, asc, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void
}) {
  return (
    <th className="text-left py-3 px-4">
      <button onClick={() => onSort(key)} className="inline-flex items-center gap-1 font-medium text-text-secondary hover:text-text-primary transition-colors">
        {label}
        {current === key && <ChevronDown className={cn('w-3 h-3 transition-transform', !asc && 'rotate-180')} />}
      </button>
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; className: string }> = {
    draft: { icon: Clock, className: 'bg-warning-light text-warning' },
    confirmed: { icon: CheckCircle, className: 'bg-info-light text-info' },
    delivered: { icon: Truck, className: 'bg-success-light text-success' },
    cancelled: { icon: XCircle, className: 'bg-error-light text-error' },
  }
  const c = config[status] || config.draft
  const Icon = c.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', c.className)}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  )
}
