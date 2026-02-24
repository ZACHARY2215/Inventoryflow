import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp, Package, DollarSign, ShoppingCart, AlertTriangle,
  RotateCcw, Calendar,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import usePageTitle from '@/hooks/usePageTitle'

const COLORS = ['#0369A1', '#0891B2', '#16A34A', '#D97706', '#9333EA', '#F97316', '#DB2777', '#64748B']
const STATUS_COLORS: Record<string, string> = {
  draft: '#D97706',
  confirmed: '#0369A1',
  delivered: '#16A34A',
  cancelled: '#F97316',  // softer orange-red instead of harsh DC2626
}

export default function Analytics() {
  usePageTitle('Analytics')
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const [ordersData, productsData, itemsData, returnsData] = await Promise.all([
        apiFetch<any[]>('/api/query', { method: 'POST', body: JSON.stringify({ table: 'blast_orders' }) }),
        apiFetch<any[]>('/api/query', { method: 'POST', body: JSON.stringify({ table: 'blast_products' }) }),
        apiFetch<any[]>('/api/query', { method: 'POST', body: JSON.stringify({ table: 'blast_order_items', select: '*, blast_products(name, category)' }) }),
        apiFetch<any[]>('/api/query', { method: 'POST', body: JSON.stringify({ table: 'blast_returns' }) }),
      ])
      setOrders(ordersData || [])
      setProducts(productsData || [])
      setItems(itemsData || [])
      setReturns(returnsData || [])
    } catch (error: any) {
      console.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter orders by date range
  const filteredOrders = orders.filter(o => {
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(o.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const confirmed = filteredOrders.filter(o => o.status === 'confirmed' || o.status === 'delivered')
  const totalRevenue = confirmed.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const avgOrderValue = confirmed.length > 0 ? totalRevenue / confirmed.length : 0

  // Monthly sales trend
  const monthlyMap: Record<string, number> = {}
  confirmed.forEach(o => {
    const m = new Date(o.created_at).toLocaleString('en', { month: 'short', year: '2-digit' })
    monthlyMap[m] = (monthlyMap[m] || 0) + Number(o.total_amount || 0)
  })
  const monthlySales = Object.entries(monthlyMap).map(([name, revenue]) => ({ name, revenue }))

  // Order count trend
  const orderCountMap: Record<string, number> = {}
  filteredOrders.forEach(o => {
    const m = new Date(o.created_at).toLocaleString('en', { month: 'short', year: '2-digit' })
    orderCountMap[m] = (orderCountMap[m] || 0) + 1
  })
  const orderCountTrend = Object.entries(orderCountMap).map(([name, count]) => ({ name, count }))

  // Sales by status
  const statusMap: Record<string, number> = {}
  filteredOrders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1 })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  // Revenue by category
  const categoryMap: Record<string, number> = {}
  items.forEach((item: any) => {
    const category = (item.blast_products as any)?.category || 'Other'
    categoryMap[category] = (categoryMap[category] || 0) + Number(item.total_price || 0)
  })
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))

  // Top products
  const prodMap: Record<string, { name: string; revenue: number; qty: number }> = {}
  items.forEach((item: any) => {
    const name = (item.blast_products as any)?.name || 'Unknown'
    if (!prodMap[item.product_id]) prodMap[item.product_id] = { name, revenue: 0, qty: 0 }
    prodMap[item.product_id].revenue += Number(item.total_price || 0)
    prodMap[item.product_id].qty += item.cases_ordered
  })
  const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  // Stock valuation & alerts
  const stockValue = products.reduce((s, p) => s + (p.inventory_pieces * Number(p.unit_price_piece)), 0)
  const lowStockProducts = products.filter(p => p.inventory_pieces > 0 && p.inventory_pieces < (p.low_stock_threshold || p.pieces_per_case * 5))
  const outOfStockProducts = products.filter(p => p.inventory_pieces <= 0)

  // Returns stats
  const pendingReturns = returns.filter(r => r.status === 'pending').length

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-text-cta">Analytics</h1><p className="text-sm text-text-secondary mt-1">Sales performance and inventory insights</p></div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-text-tertiary" />
          <input
            type="date"
            className="h-9 px-3 rounded-xl border border-border bg-surface text-sm font-sans text-text-primary focus:border-cta focus:ring-2 focus:ring-cta/20 outline-none transition-all cursor-pointer"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span className="text-text-tertiary text-xs">to</span>
          <input
            type="date"
            className="h-9 px-3 rounded-xl border border-border bg-surface text-sm font-sans text-text-primary focus:border-cta focus:ring-2 focus:ring-cta/20 outline-none transition-all cursor-pointer"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-error hover:underline">Clear</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-primary bg-cta/10' },
          { label: 'Orders', value: filteredOrders.length.toString(), icon: ShoppingCart, color: 'text-info bg-info-light' },
          { label: 'Avg Order', value: formatCurrency(avgOrderValue), icon: TrendingUp, color: 'text-success bg-success-light' },
          { label: 'Stock Value', value: formatCurrency(stockValue), icon: Package, color: 'text-warning bg-warning-light' },
          { label: 'Low Stock', value: lowStockProducts.length.toString(), icon: AlertTriangle, color: 'text-warning bg-warning-light' },
          { label: 'Returns', value: pendingReturns.toString(), icon: RotateCcw, color: 'text-error bg-error-light' },
        ].map((s, i) => (
          <div key={i} className="neu-card p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-text-tertiary">{s.label}</span><div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center`}><s.icon className="w-4 h-4" /></div></div>
            <p className="text-xl font-bold font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neu-card p-5">
          <h2 className="font-semibold mb-4">Monthly Revenue</h2>
          {monthlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySales}>
                <defs>
                  <linearGradient id="analyticsRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0369A1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0891B2" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']} />
                <Bar dataKey="revenue" fill="url(#analyticsRevGrad)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-text-tertiary text-sm">No data</div>}
        </div>

        <div className="neu-card p-5">
          <h2 className="font-semibold mb-4">Order Volume Trend</h2>
          {orderCountTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={orderCountTrend}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} /></LineChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-text-tertiary text-sm">No data</div>}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neu-card p-5">
          <h2 className="font-semibold mb-4">Orders by Status</h2>
          {statusData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart><Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={85} stroke="none">
                  {statusData.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.name] || COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">{statusData.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_COLORS[s.name] || COLORS[i] }} /><span className="text-text-secondary capitalize flex-1">{s.name}</span><span className="font-mono font-medium">{s.value}</span></div>
              ))}</div>
            </div>
          ) : <div className="h-52 flex items-center justify-center text-text-tertiary text-sm">No data</div>}
        </div>

        <div className="neu-card p-5">
          <h2 className="font-semibold mb-4">Revenue by Category</h2>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart><Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={85} stroke="none">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']} /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">{categoryData.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i] }} /><span className="text-text-secondary flex-1">{c.name}</span><span className="font-mono font-medium">{formatCurrency(c.value)}</span></div>
              ))}</div>
            </div>
          ) : <div className="h-52 flex items-center justify-center text-text-tertiary text-sm">No data</div>}
        </div>
      </div>

      {/* Top Products */}
      <div className="neu-card p-5">
        <h2 className="font-semibold mb-4">Top Products by Revenue</h2>
        {topProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <defs>
                <linearGradient id="topProdGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0369A1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#0891B2" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']} />
              <Bar dataKey="revenue" fill="url(#topProdGrad)" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-52 flex items-center justify-center text-text-tertiary text-sm">No data</div>}
      </div>

      {/* Stock Alerts */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="neu-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Stock Alerts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outOfStockProducts.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-error-light border border-error/20">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center"><Package className="w-5 h-5 text-error" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-error font-heading font-semibold">OUT OF STOCK</p>
                </div>
              </div>
            ))}
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-warning-light border border-warning/20">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center"><Package className="w-5 h-5 text-warning" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-warning font-medium">{p.inventory_pieces} pcs remaining</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
