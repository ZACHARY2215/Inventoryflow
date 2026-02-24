import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { CreditCard, Search, DollarSign, Clock, CheckCircle } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

export default function Payments() {
  usePageTitle('Payments')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await apiFetch<any[]>('/api/query', {
        method: 'POST',
        body: JSON.stringify({
          table: 'blast_orders',
          in: { status: ['confirmed', 'delivered'] },
          order: { column: 'created_at', ascending: false }
        })
      })
      setOrders(data || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch payments')
    } finally {
      setLoading(false)
    }
  }

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const confirmed = orders.filter(o => o.status === 'confirmed')
  const delivered = orders.filter(o => o.status === 'delivered')
  const filtered = orders.filter(o => o.order_number.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-text-cta">Payments</h1><p className="text-sm text-text-secondary mt-1">Track order payments and revenue</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-card p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-cta" /></div><div><p className="text-xs text-text-tertiary">Total Revenue</p><p className="text-xl font-bold font-mono">{formatCurrency(totalRevenue)}</p></div></div>
        <div className="neu-card p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-warning-light flex items-center justify-center"><Clock className="w-5 h-5 text-warning" /></div><div><p className="text-xs text-text-tertiary">Pending Delivery</p><p className="text-xl font-bold font-mono">{confirmed.length}</p></div></div>
        <div className="neu-card p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-success-light flex items-center justify-center"><CheckCircle className="w-5 h-5 text-success" /></div><div><p className="text-xs text-text-tertiary">Completed</p><p className="text-xl font-bold font-mono">{delivered.length}</p></div></div>
      </div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" /><input type="text" placeholder="Search by order number..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} /></div>

      <div className="neu-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
        filtered.length === 0 ? <div className="text-center py-16"><CreditCard className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" /><p className="text-text-secondary font-medium">No payment records</p></div> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/50 bg-background-alt">
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Order #</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Amount</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Date</th>
            </tr></thead>
            <tbody>{filtered.map(o => (
              <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-background-alt/50">
                <td className="py-3 px-4 font-mono font-medium">{o.order_number}</td>
                <td className="py-3 px-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${o.status === 'delivered' ? 'bg-success-light text-success' : 'bg-info-light text-info'}`}>{o.status}</span></td>
                <td className="py-3 px-4 font-mono font-medium">{formatCurrency(Number(o.total_amount))}</td>
                <td className="py-3 px-4 text-text-secondary text-xs">{formatDateTime(o.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </div>
    </div>
  )
}
