import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { cn, formatCurrency, formatDateTime, exportToCsv } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import {
  ArrowLeft, Phone, Mail, MapPin, ShoppingCart, CreditCard,
  ChevronRight, Package, Download, Wallet, Hash, CheckCircle,
  AlertCircle, TrendingDown,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Customer {
  id: string; name: string; phone: string; email: string | null
  address: string | null; customer_type: string; credit_limit: number
  outstanding_balance: number; is_active: boolean; created_at: string
}

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  payment_method: string | null; created_at: string; delivered_at: string | null
}

interface Payment {
  id: string; amount: number; payment_mode: string; reference_number: string | null
  balance_before: number; balance_after: number; created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-background-alt text-text-secondary',
  confirmed: 'bg-info-light text-info',
  delivered: 'bg-success-light text-success',
  cancelled: 'bg-error-light text-error',
}

const PAY_MODE_ICON: Record<string, string> = {
  Cash: '💵', GCash: '📱', 'Bank Transfer': '🏦', Check: '📝', Credit: '💳',
}

export default function CustomerDetail() {
  usePageTitle('Customer Details')
  const { id } = useParams()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'orders' | 'payments'>('orders')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [payPage, setPayPage] = useState(1)
  const [payPageSize, setPayPageSize] = useState(10)

  useEffect(() => { if (id) load() }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const custData = await apiFetch<Customer>('/api/query', {
        method: 'POST',
        body: JSON.stringify({ table: 'blast_customers', eq: { id }, single: true })
      })
      if (!custData) { toast.error('Customer not found'); setLoading(false); return }
      setCustomer(custData)

      const [ordersData, paymentsData] = await Promise.all([
        apiFetch<Order[]>('/api/query', {
          method: 'POST',
          body: JSON.stringify({ table: 'blast_orders', eq: { customer_id: id }, order: { column: 'created_at', ascending: false } })
        }),
        apiFetch<Payment[]>('/api/query', {
          method: 'POST',
          body: JSON.stringify({ table: 'blast_customer_payments', eq: { customer_id: id }, order: { column: 'created_at', ascending: false } })
        })
      ])
      
      setOrders(ordersData || [])
      setPayments(paymentsData || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customer details')
    } finally {
      setLoading(false)
    }
  }

  const pagedOrders = orders.slice((page - 1) * pageSize, page * pageSize)
  const pagedPayments = payments.slice((payPage - 1) * payPageSize, payPage * payPageSize)

  const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0)
  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-3 border-cta/30 border-t-primary rounded-full animate-spin" />
    </div>
  )

  if (!customer) return (
    <div className="text-center py-16">
      <p className="text-text-secondary">Customer not found</p>
      <Link to="/customers" className="text-primary text-sm mt-2 hover:underline">← Back to customers</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link to="/customers" className="p-2 rounded-xl hover:bg-background-alt transition-all duration-200">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-cta">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-text-secondary">
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>
            {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {customer.address}</span>}
          </div>
        </div>
        <span className={cn(
          'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase',
          customer.is_active ? 'bg-success-light text-success' : 'bg-error-light text-error'
        )}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Orders', value: orders.length, icon: ShoppingCart, color: 'text-primary bg-cta/10' },
          { label: 'Delivered', value: deliveredCount, icon: Package, color: 'text-success bg-success-light' },
          { label: 'Total Billed', value: formatCurrency(totalSpent), icon: CreditCard, color: 'text-info bg-info-light' },
          { label: 'Total Paid', value: formatCurrency(totalPaid), icon: Wallet, color: 'text-success bg-success-light' },
          { label: 'Balance Due', value: formatCurrency(customer.outstanding_balance), icon: customer.outstanding_balance > 0 ? AlertCircle : CheckCircle, color: customer.outstanding_balance > 0 ? 'text-warning bg-warning-light' : 'text-success bg-success-light' },
        ].map(stat => (
          <div key={stat.label} className="neu-card p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-tertiary truncate">{stat.label}</p>
              <p className="text-base font-bold font-mono truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'orders', label: 'Order History', count: orders.length },
          { key: 'payments', label: 'Payment History', count: payments.length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
              activeTab === tab.key
                ? 'border-cta text-cta'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {tab.label}
            <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
              activeTab === tab.key ? 'bg-cta text-white' : 'bg-background-alt text-text-secondary'
            )}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Order History Tab */}
      {activeTab === 'orders' && (
        <div className="neu-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-heading font-semibold">Order History</h2>
            {orders.length > 0 && (
              <button
                onClick={() => exportToCsv(`orders-${customer.name}`, orders.map(o => ({
                  order_number: o.order_number, status: o.status, total: o.total_amount,
                  payment: o.payment_method || '', date: formatDateTime(o.created_at),
                })), [
                  { key: 'order_number', label: 'Order #' }, { key: 'status', label: 'Status' },
                  { key: 'total', label: 'Total' }, { key: 'payment', label: 'Payment' },
                  { key: 'date', label: 'Date' },
                ])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-background-alt transition-all duration-200 no-print"
              >
                <Download className="w-3 h-3" /> Export
              </button>
            )}
          </div>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-10 h-10 text-text-tertiary mx-auto mb-2 opacity-50" />
              <p className="text-sm text-text-secondary">No orders yet</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {pagedOrders.map(o => (
                  <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-background-alt/50 transition-all duration-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{o.order_number}</p>
                      <p className="text-xs text-text-tertiary">{formatDateTime(o.created_at)}</p>
                    </div>
                    {o.payment_method && (
                      <span className="text-xs text-text-tertiary hidden sm:block">{o.payment_method}</span>
                    )}
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', STATUS_COLORS[o.status] || 'bg-background-alt text-text-secondary')}>
                      {o.status}
                    </span>
                    <span className="font-mono text-sm font-medium">{formatCurrency(Number(o.total_amount))}</span>
                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                  </Link>
                ))}
              </div>
              <Pagination currentPage={page} totalItems={orders.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
            </>
          )}
        </div>
      )}

      {/* Payment History Tab */}
      {activeTab === 'payments' && (
        <div className="neu-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-heading font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-success" /> Payment History
            </h2>
            {payments.length > 0 && (
              <button
                onClick={() => exportToCsv(`payments-${customer.name}`, payments.map(p => ({
                  date: formatDateTime(p.created_at),
                  amount: p.amount, mode: p.payment_mode,
                  reference: p.reference_number || '',
                  balance_before: p.balance_before,
                  balance_after: p.balance_after,
                })), [
                  { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount Paid' },
                  { key: 'mode', label: 'Payment Mode' }, { key: 'reference', label: 'Reference No.' },
                  { key: 'balance_before', label: 'Balance Before' }, { key: 'balance_after', label: 'Balance After' },
                ])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-background-alt transition-all duration-200 no-print"
              >
                <Download className="w-3 h-3" /> Export
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-10 h-10 text-text-tertiary mx-auto mb-2 opacity-50" />
              <p className="text-sm text-text-secondary">No payments recorded yet</p>
              <p className="text-xs text-text-tertiary mt-1">Payments made by this customer will appear here</p>
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-3 divide-x divide-border bg-background-alt border-b border-border">
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-text-tertiary">Payments Made</p>
                  <p className="font-bold text-lg font-mono">{payments.length}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-text-tertiary">Total Paid</p>
                  <p className="font-bold text-lg font-mono text-success">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-text-tertiary">Remaining Balance</p>
                  <p className={cn("font-bold text-lg font-mono", customer.outstanding_balance > 0 ? "text-warning" : "text-success")}>
                    {formatCurrency(customer.outstanding_balance)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border">
                {pagedPayments.map(p => (
                  <div key={p.id} className="flex items-start gap-4 px-4 py-4 hover:bg-background-alt/40 transition-all duration-200">
                    {/* Mode icon */}
                    <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0 text-base">
                      {PAY_MODE_ICON[p.payment_mode] || '💰'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{p.payment_mode}</span>
                        {p.reference_number && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary font-mono bg-background-alt px-1.5 py-0.5 rounded">
                            <Hash className="w-2.5 h-2.5" />{p.reference_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5">{formatDateTime(p.created_at)}</p>
                      {/* Balance trail */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-text-tertiary">
                        <span className="font-mono">{formatCurrency(p.balance_before)}</span>
                        <TrendingDown className="w-3 h-3 text-success" />
                        <span className={cn("font-mono font-medium", p.balance_after === 0 ? "text-success" : "text-warning")}>
                          {formatCurrency(p.balance_after)}
                        </span>
                        {p.balance_after === 0 && (
                          <span className="inline-flex items-center gap-0.5 text-success font-semibold">
                            <CheckCircle className="w-3 h-3" /> Settled
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-success text-base">+{formatCurrency(p.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination currentPage={payPage} totalItems={payments.length} pageSize={payPageSize} onPageChange={setPayPage} onPageSizeChange={s => { setPayPageSize(s); setPayPage(1) }} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
