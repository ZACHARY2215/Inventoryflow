import { useEffect, useState } from 'react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, formatCurrency, piecesToCasesAndPieces, generateOrderNumber } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingCart, Plus, Minus, Trash2, Search,
  PackageSearch, CheckCircle, Save, ChevronLeft,
  Download, X, User, CreditCard, Percent, DollarSign, Printer, Hash,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Product {
  id: string; sku: string; name: string; unit_price_piece: number
  wholesale_price_piece: number | null
  pieces_per_case: number; inventory_pieces: number
  image_url: string | null; category: string; is_active: boolean
}

interface CartItem extends Product {
  qty: number
  unit: 'case' | 'piece'
}

interface Customer {
  id: string; name: string; phone: string; outstanding_balance: number
}

const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Check', 'Credit', 'Installment']
const NEEDS_REF = ['GCash', 'Bank Transfer', 'Check', 'Credit']

export default function Pos() {
  usePageTitle('Point of Sale')
  const { user, isAdmin } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Order fields
  const [customerName, setCustomerName] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none')
  const [discountValue, setDiscountValue] = useState('')

  // Invoice dialog
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  useEffect(() => { fetchProducts(); fetchCustomers() }, [])

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('blast_products').select('*').order('name')
    if (error) toast.error(error.message)
    else setProducts(data || [])
    setLoading(false)
  }

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('blast_customers').select('id, name, phone, outstanding_balance').eq('is_active', true).order('name')
    if (error) return
    setCustomers(data || [])
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  )

  const addToCart = (product: Product, unit: 'case' | 'piece' = 'case') => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id && i.unit === unit)
      if (existing) {
        return prev.map(i => i.id === product.id && i.unit === unit ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1, unit }]
    })
  }

  const updateQty = (id: string, unit: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id && i.unit === unit) {
        const newQty = i.qty + delta
        return newQty > 0 ? { ...i, qty: newQty } : i
      }
      return i
    }))
  }

  const setQtyDirect = (id: string, unit: string, val: string) => {
    const num = parseInt(val, 10)
    if (val === '') {
      setCart(prev => prev.map(i => i.id === id && i.unit === unit ? { ...i, qty: 0 } : i))
      return
    }
    if (isNaN(num) || num < 0) return
    setCart(prev => prev.map(i => i.id === id && i.unit === unit ? { ...i, qty: num } : i))
  }

  const removeFromCart = (id: string, unit: string) => {
    setCart(prev => prev.filter(i => !(i.id === id && i.unit === unit)))
  }

  const getLinePieces = (item: CartItem) => item.unit === 'case' ? item.qty * item.pieces_per_case : item.qty
  const getLineTotal = (item: CartItem) => getLinePieces(item) * item.unit_price_piece
  const getLineCost = (item: CartItem) => item.wholesale_price_piece ? getLinePieces(item) * item.wholesale_price_piece : null

  const subtotal = cart.reduce((sum, item) => sum + getLineTotal(item), 0)
  const totalPieces = cart.reduce((sum, item) => sum + getLinePieces(item), 0)

  const discountAmount = (() => {
    if (discountType === 'none' || !discountValue) return 0
    const v = parseFloat(discountValue)
    if (isNaN(v) || v < 0) return 0
    if (discountType === 'percent') return Math.min(subtotal * (v / 100), subtotal)
    return Math.min(v, subtotal)
  })()

  const totalAmount = subtotal - discountAmount

  const totalCost = isAdmin
    ? cart.reduce((sum, item) => {
        const c = getLineCost(item)
        return c !== null ? sum + c : sum
      }, 0)
    : null

  const filteredProducts = products.filter(p =>
    p.is_active && (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  )

  const isInstallment = paymentMethod === 'Installment'
  const needsRef = NEEDS_REF.includes(paymentMethod)

  const resetForm = () => {
    setCart([])
    setCustomerName('')
    setSelectedCustomer(null)
    setCustomerSearch('')
    setReferenceNumber('')
    setDiscountType('none')
    setDiscountValue('')
  }

  const saveOrder = async (confirm: boolean) => {
    if (cart.length === 0) return
    if (cart.some(i => i.qty <= 0)) { toast.error('All items must have qty > 0'); return }
    if (isInstallment && !selectedCustomer) { toast.error('Please select a registered customer for Installment orders'); return }
    if (needsRef && !referenceNumber.trim()) { toast.error(`Reference number required for ${paymentMethod} payments`); return }
    setProcessing(true)
    setSuccessMsg('')
    setCompletedOrderId(null)

    try {
      const orderNumber = generateOrderNumber()
      const { data: orderData, error: orderError } = await supabase
        .from('blast_orders')
        .insert({
          order_number: orderNumber,
          user_id: user?.id,
          status: 'draft',
          total_amount: totalAmount,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || customerName.trim() || null,
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim() || null,
          discount_type: discountType,
          discount_value: discountAmount,
        })
        .select().single()
      if (orderError) throw orderError

      const items = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        // For 'case' orders: store actual cases + product's pieces_per_case
        // For 'piece' orders: store pieces as qty with pieces_per_case=1 so
        // the DB generated column (cases_ordered × ppc × price) stays correct
        cases_ordered: item.qty,
        pieces_per_case_snapshot: item.unit === 'case' ? item.pieces_per_case : 1,
        unit_price_piece_snapshot: item.unit_price_piece,
      }))
      const { error: itemsError } = await supabase.from('blast_order_items').insert(items)
      if (itemsError) throw itemsError

      if (confirm) {
        const { data, error: edgeError } = await supabase.functions.invoke('inv_confirm_order', {
          body: { order_id: orderData.id },
        })
        if (edgeError || (data && !data.success)) throw new Error(data?.error || edgeError?.message || 'Failed')

        // If installment, add debt to customer's outstanding balance
        if (isInstallment && selectedCustomer) {
          await supabase
            .from('blast_customers')
            .update({ outstanding_balance: selectedCustomer.outstanding_balance + totalAmount })
            .eq('id', selectedCustomer.id)
        }

        setSuccessMsg(`Order ${orderNumber} confirmed! ${isInstallment ? `₱${totalAmount.toFixed(2)} added to ${selectedCustomer?.name}'s balance.` : 'Stock deducted.'}`)
        setCompletedOrderId(orderData.id)
      } else {
        setSuccessMsg(`Draft ${orderNumber} saved.`)
      }
      resetForm()
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const openInvoiceDialog = async () => {
    if (!completedOrderId) return
    setShowInvoiceDialog(true)
    setInvoiceLoading(true)
    setInvoiceUrl('')
    try {
      const { data, error } = await invokeEdgeFunction('inv_generate_invoice', {
        body: { order_id: completedOrderId },
      })
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed')
      setInvoiceUrl(data.url)
    } catch (err: any) {
      toast.error(err.message)
      setShowInvoiceDialog(false)
    } finally {
      setInvoiceLoading(false)
    }
  }

  return (
    <div className={cn("space-y-6", isMobileCartOpen ? "space-y-0 lg:space-y-6" : "")}>
      <div className={cn(isMobileCartOpen ? "hidden lg:block" : "block")}>
        <h1 className="text-2xl font-bold text-text-cta">Point of Sale</h1>
        <p className="text-sm text-text-secondary mt-1">Create orders and process sales</p>
      </div>

      {successMsg && (
        <div className={cn("bg-success-light border border-success/20 rounded-xl p-4 flex-wrap items-center justify-between gap-3", isMobileCartOpen ? "hidden lg:flex" : "flex")}>
          <div className="flex items-center gap-2 text-success text-sm font-medium flex-1 min-w-0">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
          {completedOrderId && (
            <button onClick={openInvoiceDialog} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-success/30 text-success text-xs font-medium hover:bg-success/10">
              <Download className="w-3 h-3" /> Invoice PDF
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px] gap-6 items-start">
        {/* Products */}
        <div className={cn("space-y-4 min-w-0", isMobileCartOpen ? "hidden lg:block" : "block")}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="text" placeholder="Search products..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4">
              {filteredProducts.map(p => {
                const isLow = p.inventory_pieces < p.pieces_per_case * 5
                const isOut = p.inventory_pieces <= 0
                const margin = isAdmin && p.wholesale_price_piece && p.unit_price_piece
                  ? ((p.unit_price_piece - p.wholesale_price_piece) / p.unit_price_piece * 100).toFixed(0)
                  : null
                return (
                  <div key={p.id} className={cn(
                    'bg-surface rounded-xl border p-4 transition-all hover:shadow-md',
                    isOut ? 'border-error/30 opacity-60' : isLow ? 'border-warning/30' : 'border-border'
                  )}>
                    <div className="flex gap-3 mb-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-lg object-cover border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-background-alt flex items-center justify-center flex-shrink-0">
                          <PackageSearch className="w-6 h-6 text-text-tertiary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-medium text-sm leading-tight line-clamp-2" title={p.name}>{p.name}</h4>
                          <div className="flex flex-col items-end gap-0.5 shrink-0 ml-1">
                            {isLow && !isOut && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warning-light text-warning">Low</span>}
                            {isOut && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-error-light text-error">Out</span>}
                          </div>
                        </div>
                        <p className="text-xs font-mono text-text-tertiary">{p.sku}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-cta/10 text-primary mt-0.5">{p.category}</span>
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary mb-3 space-y-0.5">
                      <div>Stock: <span className="font-mono font-medium">{piecesToCasesAndPieces(p.inventory_pieces, p.pieces_per_case)}</span></div>
                      <div>Sell: <span className="font-mono">{formatCurrency(p.unit_price_piece)}</span>/pc · <span className="font-mono">{formatCurrency(p.unit_price_piece * p.pieces_per_case)}</span>/case</div>
                      {isAdmin && p.wholesale_price_piece ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-tertiary">Cost: <span className="font-mono">{formatCurrency(p.wholesale_price_piece)}</span>/pc</span>
                          {margin && <span className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold bg-success-light text-success">{margin}% margin</span>}
                        </div>
                      ) : null}
                      <div className="text-text-tertiary">{p.pieces_per_case} pcs/case</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => addToCart(p, 'case')} disabled={isOut} className="flex-1 min-w-0 py-1.5 rounded-md bg-cta hover:bg-cta-dark text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed truncate">
                        + Case
                      </button>
                      <button onClick={() => addToCart(p, 'piece')} disabled={isOut} className="flex-1 min-w-0 py-1.5 rounded-md border border-border hover:bg-background-alt text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed truncate">
                        + Piece
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mobile View Cart FAB */}
        {cart.length > 0 && (
          <div className={cn("lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm pointer-events-none", isMobileCartOpen ? "hidden" : "block")}>
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="w-full h-14 bg-cta rounded-2xl shadow-[var(--shadow-neu)] text-white font-medium flex items-center justify-between px-6 hover:bg-cta-dark transition-colors pointer-events-auto"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--color-primary)]">
                    {cart.length}
                  </span>
                </div>
                <span className="text-sm">View Cart</span>
              </div>
              <span className="font-mono text-lg font-bold">{formatCurrency(totalAmount)}</span>
            </button>
          </div>
        )}

        {/* Cart Panel (Mobile Page / Desktop Sticky Sidebar) */}
        <div className={cn(
          "w-full lg:sticky lg:top-6 lg:self-start",
          isMobileCartOpen ? "block animate-fade-in" : "hidden lg:block"
        )}>
          <div className="w-full pb-24 lg:pb-0">
            <div className="neu-card p-4 sm:p-5 bg-surface z-10 min-h-[calc(100vh-10rem)] lg:min-h-0">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50 lg:pb-0 lg:border-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMobileCartOpen(false)}
                    className="lg:hidden p-2 -ml-2 text-text-secondary hover:bg-background-alt hover:text-text-primary rounded-lg transition-colors flex items-center"
                  >
                    <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium pr-1">Products</span>
                  </button>
                  <h2 className="font-heading font-semibold text-lg flex items-center gap-2 ml-1 lg:ml-0">
                    <ShoppingCart className="w-5 h-5 text-cta hidden lg:block" />
                    <span className="hidden sm:inline">Current Order</span>
                    <span className="sm:hidden font-bold">Cart</span>
                  </h2>
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-10 text-text-tertiary">
                  <PackageSearch className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs mt-1">Add products to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Customer & Payment */}
                  <div className="space-y-3 pb-3 border-b border-border">
                    {/* Customer Name / Search */}
                    <div className="relative">
                      <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1 mb-1">
                        <User className="w-3 h-3" /> {isInstallment ? 'Customer (required)' : 'Customer Name'}
                      </label>
                      {isInstallment ? (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search customer..."
                            className={cn(
                              "w-full h-9 px-3 rounded-xl border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none bg-background",
                              selectedCustomer ? "border-success text-success font-medium" : "border-border"
                            )}
                            value={selectedCustomer ? `${selectedCustomer.name} (₱${selectedCustomer.outstanding_balance.toFixed(2)} balance)` : customerSearch}
                            onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerDropdown(true) }}
                            onFocus={() => setShowCustomerDropdown(true)}
                          />
                          {selectedCustomer && (
                            <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-error">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {showCustomerDropdown && !selectedCustomer && filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                              {filteredCustomers.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false) }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-background-alt transition-colors"
                                >
                                  <div className="font-medium">{c.name}</div>
                                  <div className="text-xs text-text-tertiary flex items-center justify-between">
                                    <span>{c.phone}</span>
                                    <span className={cn("font-mono", c.outstanding_balance > 0 ? "text-warning" : "text-success")}>
                                      Balance: {formatCurrency(c.outstanding_balance)}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Walk-in customer"
                          className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                        />
                      )}
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1 mb-1">
                        <CreditCard className="w-3 h-3" /> Payment Method
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_METHODS.map(m => (
                          <button
                            key={m}
                            onClick={() => { setPaymentMethod(m); setReferenceNumber('') }}
                            className={cn(
                              'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                              paymentMethod === m
                                ? m === 'Installment' ? 'bg-warning text-white' : 'bg-cta text-white'
                                : 'bg-background-alt border border-border text-text-secondary hover:bg-border'
                            )}
                          >{m}</button>
                        ))}
                      </div>
                    </div>

                    {/* Installment notice */}
                    {isInstallment && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning-light border border-warning/20 text-warning text-xs">
                        <DollarSign className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span><strong>{formatCurrency(totalAmount)}</strong> will be added to the customer's outstanding balance upon confirmation.</span>
                      </div>
                    )}

                    {/* Reference Number */}
                    {needsRef && (
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1 mb-1">
                          <Hash className="w-3 h-3" /> Reference No. <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder={`${paymentMethod} reference/transaction no.`}
                          className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                          value={referenceNumber}
                          onChange={e => setReferenceNumber(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Cart items */}
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                    {cart.map(item => {
                      const lineTotal = getLineTotal(item)
                      const lineCost = isAdmin ? getLineCost(item) : null
                      return (
                        <div key={`${item.id}-${item.unit}`} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-text-tertiary">
                              <span className="font-mono">{formatCurrency(lineTotal)}</span>
                              <span className="opacity-50">·</span>
                              <span>{getLinePieces(item)} pcs</span>
                              <span className="uppercase px-1 py-px rounded bg-background-alt font-medium">{item.unit}</span>
                            </div>
                            {lineCost !== null && (
                              <div className="text-[10px] text-text-tertiary mt-0.5">
                                Cost: <span className="font-mono">{formatCurrency(lineCost)}</span>
                                <span className="ml-1 text-success font-medium">+{formatCurrency(lineTotal - lineCost)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2 sm:ml-3">
                            <button onClick={() => updateQty(item.id, item.unit, -1)} className="w-7 h-7 shrink-0 rounded-md border border-border flex items-center justify-center hover:bg-background-alt transition-all duration-200"><Minus className="w-3 h-3" /></button>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-10 h-7 shrink-0 min-w-0 text-center font-mono text-sm border border-border rounded-md bg-background outline-none focus:border-cta"
                              value={item.qty}
                              onChange={e => setQtyDirect(item.id, item.unit, e.target.value)}
                              onBlur={() => { if (item.qty <= 0) removeFromCart(item.id, item.unit) }}
                            />
                            <button onClick={() => updateQty(item.id, item.unit, 1)} className="w-7 h-7 shrink-0 rounded-md border border-border flex items-center justify-center hover:bg-background-alt transition-all duration-200"><Plus className="w-3 h-3" /></button>
                            <button onClick={() => removeFromCart(item.id, item.unit)} className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-error/60 hover:text-error hover:bg-error-light transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Discount */}
                  <div className="border-t border-border/50 pt-3">
                    <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1 mb-1.5">
                      <Percent className="w-3 h-3" /> Discount
                    </label>
                    <div className="flex gap-2">
                      <div className="flex rounded-xl border border-border overflow-hidden bg-background">
                        {(['none', 'percent', 'fixed'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => { setDiscountType(t); if (t === 'none') setDiscountValue('') }}
                            className={cn(
                              'px-2.5 py-1.5 text-[11px] font-medium transition-colors capitalize',
                              discountType === t ? 'bg-cta text-white' : 'text-text-secondary hover:bg-background-alt'
                            )}
                          >{t === 'none' ? 'None' : t === 'percent' ? '%' : '₱'}</button>
                        ))}
                      </div>
                      {discountType !== 'none' && (
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={discountType === 'percent' ? '10' : '500'}
                            className="w-full h-8 px-3 rounded-xl border border-border text-sm font-mono bg-background focus:border-cta focus:ring-1 focus:ring-primary/20 outline-none"
                            value={discountValue}
                            onChange={e => setDiscountValue(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t-2 border-border pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-text-secondary">
                      <span>Total Pieces</span><span className="font-mono">{totalPieces.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-text-secondary">
                      <span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-success">
                        <span>Discount{discountType === 'percent' ? ` (${discountValue}%)` : ''}</span>
                        <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    {isAdmin && totalCost !== null && totalCost > 0 && (
                      <div className="flex justify-between text-xs text-text-tertiary border-t border-border/30 pt-1.5 mt-1">
                        <span>Est. total cost</span>
                        <span className="font-mono">{formatCurrency(totalCost)}</span>
                      </div>
                    )}
                    {isAdmin && totalCost !== null && totalCost > 0 && (
                      <div className="flex justify-between text-xs text-success font-medium">
                        <span>Est. gross profit</span>
                        <span className="font-mono">{formatCurrency(totalAmount - totalCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-1">
                      <span>Total</span><span className="font-mono">{formatCurrency(totalAmount)}</span>
                    </div>
                    {isInstallment && selectedCustomer && (
                      <div className="flex justify-between text-sm text-warning font-medium">
                        <span>New balance after</span>
                        <span className="font-mono">{formatCurrency(selectedCustomer.outstanding_balance + totalAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button onClick={() => {
                        saveOrder(true)
                        if (cart.length > 0) setIsMobileCartOpen(false)
                      }} disabled={processing} className="w-full h-11 rounded-xl bg-cta hover:bg-cta-dark text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {processing ? <div className="w-4 h-4 shrink-0 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle className="w-4 h-4 shrink-0" /> <span className="truncate">CONFIRM ORDER</span></>}
                    </button>
                    <button onClick={() => {
                        saveOrder(false)
                        if (cart.length > 0) setIsMobileCartOpen(false)
                      }} disabled={processing} className="w-full h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                      <Save className="w-4 h-4 shrink-0" /> <span className="truncate">Save as Draft</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Dialog */}
      {showInvoiceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px] p-4">
          <div className="neu-card shadow-xl w-full max-w-md animate-fade-in flex flex-col max-h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-cta" /> Invoice Generated
              </h2>
              <button onClick={() => setShowInvoiceDialog(false)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 text-center">
              {invoiceLoading ? (
                <div className="py-8">
                  <div className="w-8 h-8 border-2 border-cta/30 border-l-cta rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">Generating invoice PDF...</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-success" />
                  </div>
                  <p className="font-medium mb-1">Invoice Ready</p>
                  <p className="text-sm text-text-secondary mb-6">Your invoice PDF has been generated and is ready for download.</p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={() => setShowInvoiceDialog(false)}
                      className="flex-1 min-w-0 sm:flex-none sm:w-[100px] h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200 truncate"
                    >Close</button>
                    <button
                      onClick={() => {
                        if (!invoiceUrl) return
                        const w = window.open(invoiceUrl, '_blank')
                        if (w) { w.onload = () => { setTimeout(() => w.print(), 500) } }
                      }}
                      className="flex-1 min-w-0 h-10 rounded-xl border border-cta text-primary text-sm font-medium hover:bg-cta/10 transition-colors inline-flex items-center justify-center gap-2"
                    ><Printer className="w-4 h-4 shrink-0" /> <span className="truncate">Print</span></button>
                    <button
                      onClick={() => { if (invoiceUrl) window.open(invoiceUrl, '_blank') }}
                      className="flex-1 min-w-0 h-10 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                    ><Download className="w-4 h-4 shrink-0" /> <span className="truncate">Download</span></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
