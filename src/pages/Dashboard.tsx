import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/lib/utils'
import {
  Package, ShoppingCart, Users, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, ClipboardList,
  ArrowRight, Clock
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import usePageTitle from '@/hooks/usePageTitle'

interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  lowStockCount: number
  pendingOrders: number
  confirmedOrders: number
  recentOrders: any[]
}

const CHART_COLORS = ['#0369A1', '#0891B2', '#16A34A', '#D97706', '#9333EA', '#F97316']

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0, totalOrders: 0, totalRevenue: 0,
    lowStockCount: 0, pendingOrders: 0, confirmedOrders: 0,
    recentOrders: [],
  })
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [productsRes, ordersRes, orderItemsRes] = await Promise.all([
        supabase.from('blast_products').select('id, name, inventory_pieces, pieces_per_case'),
        supabase.from('blast_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('blast_order_items').select('product_id, cases_ordered, unit_price_piece_snapshot, pieces_per_case_snapshot, blast_products(name)'),
      ])

      const products = productsRes.data || []
      const orders = ordersRes.data || []
      const items = orderItemsRes.data || []

      const lowStock = products.filter(p => p.inventory_pieces < (p.pieces_per_case * 5))
      const confirmed = orders.filter(o => o.status === 'confirmed' || o.status === 'delivered')
      const revenue = confirmed.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
      const pending = orders.filter(o => o.status === 'draft')

      setStats({
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: revenue,
        lowStockCount: lowStock.length,
        pendingOrders: pending.length,
        confirmedOrders: confirmed.length,
        recentOrders: orders.slice(0, 5),
      })

      // Sales by month
      const monthMap: Record<string, number> = {}
      confirmed.forEach((o: any) => {
        const month = new Date(o.created_at).toLocaleString('en', { month: 'short' })
        monthMap[month] = (monthMap[month] || 0) + Number(o.total_amount || 0)
      })
      setSalesData(Object.entries(monthMap).map(([name, value]) => ({ name, revenue: value })))

      // Top products by order count
      const productCount: Record<string, { name: string, count: number }> = {}
      items.forEach((item: any) => {
        const name = (item.blast_products as any)?.name || 'Unknown'
        if (!productCount[item.product_id]) {
          productCount[item.product_id] = { name, count: 0 }
        }
        productCount[item.product_id].count += item.cases_ordered
      })
      const topProds = Object.values(productCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(p => ({ name: p.name, value: p.count }))
      setTopProducts(topProds)
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'text-cta',
      bg: 'bg-cta/10',
      accent: 'border-l-cta',
      featured: true,
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders.toString(),
      icon: ClipboardList,
      color: 'text-accent',
      bg: 'bg-accent/10',
      accent: 'border-l-accent',
      featured: false,
      trend: `${stats.pendingOrders} pending`,
      trendUp: null,
    },
    {
      label: 'Active Products',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'text-[#0891B2]',
      bg: 'bg-[#0891B2]/10',
      accent: 'border-l-[#0891B2]',
      featured: false,
    },
    {
      label: 'Low Stock Alerts',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: stats.lowStockCount > 0 ? 'text-warning' : 'text-success',
      bg: stats.lowStockCount > 0 ? 'bg-warning/10' : 'bg-success/10',
      accent: stats.lowStockCount > 0 ? 'border-l-warning' : 'border-l-success',
      featured: false,
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 shimmer-skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 shimmer-skeleton" />
          <div className="h-80 shimmer-skeleton" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-primary">
          Welcome back{profile?.email ? `, ${profile.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`neu-card p-5 hover:translate-y-[-2px] transition-all duration-300 border-l-[3px] ${card.accent} ${card.featured ? 'bg-cta/[0.04] ring-1 ring-cta/20' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-secondary">{card.label}</span>
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shadow-[var(--shadow-neu-inset)]`}>
                <card.icon className={`w-[18px] h-[18px] ${card.color}`} />
              </div>
            </div>
            <p className={`font-heading font-bold text-text-primary font-mono ${card.featured ? 'text-3xl' : 'text-2xl'}`}>{card.value}</p>
            {card.trend && (
              <div className="flex items-center gap-1 mt-1.5">
                {card.trendUp === true && <TrendingUp className="w-3 h-3 text-success" />}
                {card.trendUp === false && <TrendingDown className="w-3 h-3 text-error" />}
                <span className="text-xs text-text-tertiary">{card.trend}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-text-primary">Sales Overview</h2>
            <span className="text-xs text-text-tertiary">Monthly revenue</span>
          </div>
          {salesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={salesData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0369A1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0891B2" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 4px 16px -4px rgb(15 23 42 / 0.08)' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="url(#revenueGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-text-tertiary text-sm">
              No sales data yet
            </div>
          )}
        </div>

        {/* Top Products Pie */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-text-primary">Top Products</h2>
            <span className="text-xs text-text-tertiary">By cases ordered</span>
          </div>
          {topProducts.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={topProducts} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={80} stroke="none">
                    {topProducts.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-text-secondary truncate flex-1">{p.name}</span>
                    <span className="font-mono text-text-primary font-medium">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-text-tertiary text-sm">
              No product data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 neu-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-text-primary">Recent Orders</h2>
            <Link to="/orders" className="text-sm text-cta hover:text-cta-dark font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.recentOrders.length > 0 ? (
            <div className="space-y-2">
              {stats.recentOrders.map((order: any) => (
                <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between py-3 px-3.5 rounded-xl hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cta/10 flex items-center justify-center shadow-[var(--shadow-neu-inset)]">
                      <ShoppingCart className="w-4 h-4 text-cta" />
                    </div>
                    <div>
                      <p className="text-sm font-medium font-mono">{order.order_number}</p>
                      <p className="text-xs text-text-tertiary flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium font-mono">{formatCurrency(Number(order.total_amount))}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">No orders yet</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="neu-card p-5">
          <h2 className="font-heading font-semibold text-text-primary mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'New Order', href: '/pos', icon: ShoppingCart, color: 'bg-cta/10 text-cta' },
              { label: 'View Inventory', href: '/inventory', icon: Package, color: 'bg-accent/10 text-accent' },
              { label: 'View Orders', href: '/orders', icon: ClipboardList, color: 'bg-warning/10 text-warning' },
              { label: 'Manage Customers', href: '/customers', icon: Users, color: 'bg-success/10 text-success' },
            ].map((action, i) => (
              <Link key={i} to={action.href} className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center shadow-[var(--shadow-neu-inset)]`}>
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-text-primary">{action.label}</span>
                <ArrowRight className="w-4 h-4 text-text-tertiary ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-warning/10 text-warning',
    confirmed: 'bg-cta/10 text-cta',
    delivered: 'bg-success/10 text-success',
    cancelled: 'bg-error/10 text-error',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${styles[status] || 'bg-background-alt text-text-secondary'}`}>
      {status}
    </span>
  )
}
