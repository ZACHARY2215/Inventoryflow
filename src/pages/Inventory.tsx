import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, piecesToCasesAndPieces, exportToCsv } from '@/lib/utils'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import {
  Package, RefreshCw, AlertTriangle, Download,
  Search, Plus, Warehouse, X, PackagePlus, Minus, ClipboardList,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Product {
  id: string
  sku: string
  name: string
  unit_price_piece: number
  pieces_per_case: number
  inventory_pieces: number
  reserved_pieces: number
  image_url: string | null
  category: string
  low_stock_threshold: number
}

export default function Inventory() {
  usePageTitle('Inventory')
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Restock modal
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockUnit, setRestockUnit] = useState<'pieces' | 'cases'>('pieces')
  const [restockLoading, setRestockLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Adjustment modal
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState('damaged')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)

  useEffect(() => { fetchProducts() }, [])
  useEffect(() => { if (restockProduct && inputRef.current) inputRef.current.focus() }, [restockProduct])

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('blast_products').select('*').order('name')
    if (error) toast.error(error.message)
    else setProducts(data || [])
    setLoading(false)
  }

  const openRestock = (p: Product) => {
    setRestockProduct(p)
    setRestockQty('')
    setRestockUnit('pieces')
  }

  const getRestockPieces = () => {
    const raw = parseInt(restockQty, 10)
    if (isNaN(raw) || raw <= 0) return 0
    return restockUnit === 'cases' ? raw * (restockProduct?.pieces_per_case || 1) : raw
  }

  const handleRestock = async () => {
    if (!restockProduct) return
    const pieces = getRestockPieces()
    if (pieces <= 0) { toast.error('Enter a valid quantity'); return }

    setRestockLoading(true)
    try {
      const { data, error } = await invokeEdgeFunction('inv_admin_restock', {
        body: { product_id: restockProduct.id, additional_pieces: pieces },
      })
      if (error || (data && !data.success)) throw new Error(data?.error || error?.message || 'Failed')
      toast.success(`Added ${pieces} pieces to ${restockProduct.name}`)
      setRestockProduct(null)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRestockLoading(false)
    }
  }

  const handleAdjust = async () => {
    if (!adjustProduct) return
    const qty = parseInt(adjustQty, 10)
    if (isNaN(qty) || qty <= 0) { toast.error('Enter a valid quantity'); return }
    const change = -qty // adjustments are deductions
    const before = adjustProduct.inventory_pieces
    const after = before + change
    if (after < 0) { toast.error('Cannot deduct more than current stock'); return }

    setAdjustLoading(true)
    try {
      // Update product inventory
      const { error: prodErr } = await supabase
        .from('blast_products')
        .update({ inventory_pieces: after })
        .eq('id', adjustProduct.id)
      if (prodErr) throw prodErr

      // Log the adjustment
      const { error: adjErr } = await supabase
        .from('blast_inventory_adjustments')
        .insert({
          product_id: adjustProduct.id,
          adjustment_type: adjustType,
          quantity_change: change,
          quantity_before: before,
          quantity_after: after,
          reason: adjustReason.trim() || null,
          user_email: (await supabase.auth.getUser()).data.user?.email || null,
          user_id: (await supabase.auth.getUser()).data.user?.id || null,
        })
      if (adjErr) throw adjErr

      toast.success(`Adjusted ${qty} pcs from ${adjustProduct.name} (${adjustType})`)
      setAdjustProduct(null)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setAdjustLoading(false)
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    if (filter === 'low') return matchSearch && p.inventory_pieces > 0 && p.inventory_pieces < p.pieces_per_case * 5
    if (filter === 'out') return matchSearch && p.inventory_pieces === 0
    return matchSearch
  })

  useEffect(() => { setPage(1) }, [search, filter])
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const totalPieces = products.reduce((s, p) => s + p.inventory_pieces, 0)
  const totalReserved = products.reduce((s, p) => s + p.reserved_pieces, 0)
  const lowCount = products.filter(p => p.inventory_pieces > 0 && p.inventory_pieces < p.pieces_per_case * 5).length
  const outCount = products.filter(p => p.inventory_pieces === 0).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-cta">Inventory</h1>
          <p className="text-sm text-text-secondary mt-1">Track and manage warehouse stock levels</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <Link to="/inventory/adjustments" className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-background-alt transition-all duration-200">
            <ClipboardList className="w-4 h-4" /> History
          </Link>
          <button
            onClick={() => exportToCsv('inventory', filtered.map(p => ({
              sku: p.sku, name: p.name, category: p.category,
              stock: p.inventory_pieces, reserved: p.reserved_pieces,
              available: p.inventory_pieces - p.reserved_pieces,
              status: p.inventory_pieces === 0 ? 'Out of stock' : p.inventory_pieces < p.pieces_per_case * 5 ? 'Low stock' : 'OK',
            })), [
              { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
              { key: 'stock', label: 'Stock (pcs)' }, { key: 'reserved', label: 'Reserved' },
              { key: 'available', label: 'Available' }, { key: 'status', label: 'Status' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={fetchProducts} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-background-alt transition-all duration-200">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Stock', value: `${totalPieces.toLocaleString()} pcs`, icon: Warehouse, color: 'text-primary bg-cta/10' },
          { label: 'Reserved', value: `${totalReserved.toLocaleString()} pcs`, icon: Package, color: 'text-info bg-info-light' },
          { label: 'Low Stock', value: lowCount.toString(), icon: AlertTriangle, color: 'text-warning bg-warning-light' },
          { label: 'Out of Stock', value: outCount.toString(), icon: AlertTriangle, color: 'text-error bg-error-light' },
        ].map((s, i) => (
          <div key={i} className="neu-card p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary">{s.label}</p>
              <p className="text-lg font-bold font-mono">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search products..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'low', 'out'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn(
              'px-3 py-2 rounded-xl text-sm font-medium transition-colors',
              filter === f ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt'
            )}>
              {f === 'all' ? `All (${products.length})` : f === 'low' ? `Low (${lowCount})` : `Out (${outCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="neu-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" />
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-background-alt">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary w-12"></th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Available</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Reserved</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Total</th>
                  {isAdmin && <th className="text-right py-3 px-4 font-medium text-text-secondary">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const available = p.inventory_pieces - p.reserved_pieces
                  const threshold = p.low_stock_threshold || p.pieces_per_case * 5
                  const isCritical = p.inventory_pieces < p.pieces_per_case * 2
                  const isLow = p.inventory_pieces < threshold && !isCritical
                  const isOut = p.inventory_pieces === 0

                  return (
                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-background-alt/50 transition-all duration-200">
                      <td className="py-3 px-4">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-background-alt flex items-center justify-center">
                            <Package className="w-4 h-4 text-text-tertiary" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isOut ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-error-light text-error uppercase">Out</span> :
                         isCritical ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-error-light text-error uppercase">Critical</span> :
                         isLow ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-light text-warning uppercase">Low</span> :
                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-light text-success uppercase">OK</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-text-secondary">{p.sku}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{p.name}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-cta/10 text-primary mt-0.5">{p.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('font-mono font-medium', isCritical && 'text-error', isLow && 'text-warning')}>
                          {piecesToCasesAndPieces(available, p.pieces_per_case)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-text-tertiary">{p.reserved_pieces} pcs</td>
                      <td className="py-3 px-4 font-mono text-text-secondary">{piecesToCasesAndPieces(p.inventory_pieces, p.pieces_per_case)}</td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openRestock(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-background-alt transition-all duration-200"
                          >
                            <Plus className="w-3 h-3" /> Restock
                          </button>
                          <button
                            onClick={() => { setAdjustProduct(p); setAdjustType('damaged'); setAdjustQty(''); setAdjustReason('') }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-error/30 text-error hover:bg-error-light transition-colors"
                          >
                            <Minus className="w-3 h-3" /> Adjust
                          </button>
                        </td>
                      )}
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

      {/* Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-cta" /> Restock Product
              </h2>
              <button onClick={() => setRestockProduct(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Product info */}
              <div className="bg-background-alt rounded-lg p-4 space-y-1">
                <p className="font-semibold text-sm">{restockProduct.name}</p>
                <p className="text-xs font-mono text-text-tertiary">{restockProduct.sku}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                  <span>Current: <strong className="font-mono">{restockProduct.inventory_pieces} pcs</strong></span>
                  <span>({piecesToCasesAndPieces(restockProduct.inventory_pieces, restockProduct.pieces_per_case)})</span>
                </div>
              </div>

              {/* Unit toggle */}
              <div>
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">Add Stock In</label>
                <div className="flex rounded-xl border border-border overflow-hidden bg-background">
                  {(['pieces', 'cases'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setRestockUnit(u)}
                      className={cn(
                        'flex-1 py-2 text-sm font-medium transition-colors capitalize',
                        restockUnit === u ? 'bg-cta text-white' : 'text-text-secondary hover:bg-background-alt'
                      )}
                    >{u}</button>
                  ))}
                </div>
              </div>

              {/* Qty input */}
              <div>
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const n = parseInt(restockQty || '0', 10); if (n > 1) setRestockQty(String(n - 1)) }}
                    className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-background-alt transition-all duration-200"
                  ><Minus className="w-4 h-4" /></button>
                  <input
                    ref={inputRef}
                    type="number"
                    min="1"
                    placeholder="0"
                    className="flex-1 h-10 text-center font-mono text-lg border border-border rounded-lg bg-background outline-none focus:border-cta focus:ring-2 focus:ring-primary/20"
                    value={restockQty}
                    onChange={e => setRestockQty(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRestock() }}
                  />
                  <button
                    onClick={() => { const n = parseInt(restockQty || '0', 10); setRestockQty(String(n + 1)) }}
                    className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-background-alt transition-all duration-200"
                  ><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Preview */}
              {getRestockPieces() > 0 && (
                <div className="bg-success-light/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-text-secondary">After restocking:</p>
                  <p className="font-mono font-bold text-success text-lg">
                    {(restockProduct.inventory_pieces + getRestockPieces()).toLocaleString()} pcs
                  </p>
                  <p className="text-xs text-text-tertiary">
                    (+{getRestockPieces().toLocaleString()} {restockUnit === 'cases' ? `= ${restockQty} case${parseInt(restockQty) !== 1 ? 's' : ''} × ${restockProduct.pieces_per_case} pcs` : 'pieces'})
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button
                onClick={() => setRestockProduct(null)}
                className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200"
              >Cancel</button>
              <button
                onClick={handleRestock}
                disabled={restockLoading || getRestockPieces() <= 0}
                className="flex-1 h-10 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {restockLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><PackagePlus className="w-4 h-4" /> Confirm Restock</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-error" /> Stock Adjustment
              </h2>
              <button onClick={() => setAdjustProduct(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-background-alt rounded-lg p-4 space-y-1">
                <p className="font-semibold text-sm">{adjustProduct.name}</p>
                <p className="text-xs font-mono text-text-tertiary">{adjustProduct.sku}</p>
                <p className="text-xs text-text-secondary mt-1">Current: <strong className="font-mono">{adjustProduct.inventory_pieces} pcs</strong></p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">Adjustment Type</label>
                <select className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm" value={adjustType} onChange={e => setAdjustType(e.target.value)}>
                  <option value="damaged">Damaged</option>
                  <option value="expired">Expired</option>
                  <option value="theft">Theft</option>
                  <option value="return">Return</option>
                  <option value="correction">Correction</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">Quantity to Deduct</label>
                <input type="number" min="1" max={adjustProduct.inventory_pieces} className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-mono outline-none focus:border-cta focus:ring-2 focus:ring-primary/20" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5 block">Reason <span className="text-text-tertiary font-normal normal-case">(optional)</span></label>
                <textarea className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-cta focus:ring-2 focus:ring-primary/20 resize-none" rows={2} value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Describe why this adjustment is being made..." />
              </div>
              {parseInt(adjustQty) > 0 && (
                <div className="bg-error-light/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-text-secondary">After adjustment:</p>
                  <p className="font-mono font-bold text-error text-lg">
                    {(adjustProduct.inventory_pieces - parseInt(adjustQty)).toLocaleString()} pcs
                  </p>
                  <p className="text-xs text-text-tertiary">(-{parseInt(adjustQty).toLocaleString()} pieces)</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setAdjustProduct(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">Cancel</button>
              <button onClick={handleAdjust} disabled={adjustLoading || !parseInt(adjustQty)} className="flex-1 h-10 rounded-xl bg-error hover:bg-error/90 text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {adjustLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Minus className="w-4 h-4" /> Confirm Adjustment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
