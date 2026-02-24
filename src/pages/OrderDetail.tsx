import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft, CheckCircle, Truck, XCircle, FileText,
  Download, X, AlertTriangle, User, CreditCard, Printer,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

type DialogType = 'confirm' | 'deliver' | 'cancel' | 'invoice' | null

export default function OrderDetail() {
  usePageTitle('Order Details')
  const { id } = useParams()
  const navigate = useNavigate()
  useAuth()
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [dialog, setDialog] = useState<DialogType>(null)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('blast-company-name') || '')

  useEffect(() => { if (id) fetchOrder() }, [id])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      const [orderData, itemsData] = await Promise.all([
        apiFetch<any>('/api/query', {
          method: 'POST',
          body: JSON.stringify({
            table: 'blast_orders',
            eq: { id: id },
            single: true
          })
        }),
        apiFetch<any[]>('/api/query', {
          method: 'POST',
          body: JSON.stringify({
            table: 'blast_order_items',
            select: '*, blast_products(name, sku)',
            eq: { order_id: id }
          })
        })
      ])
      
      setOrder(orderData)
      setItems(itemsData || [])
    } catch (err: any) {
      if (err.status === 406 || err.message?.includes('JSON')) {
        toast.error('Order not found'); navigate('/orders');
      } else {
        toast.error('Failed to load order details')
      }
    } finally {
      setLoading(false)
    }
  }

  const doAction = async (type: 'confirm' | 'deliver' | 'cancel') => {
    setActionLoading(true)
    const msgMap = { confirm: 'Order confirmed!', deliver: 'Order marked as delivered!', cancel: 'Order cancelled' }
    try {
      if (type === 'deliver') {
        const { error } = await supabase.from('blast_orders').update({
          status: 'delivered',
          delivered_at: new Date().toISOString()
        }).eq('id', id)
        if (error) throw error
      } else {
        const fnMap = { confirm: 'inv_confirm_order', cancel: 'inv_cancel_order' }
        const { data, error } = await invokeEdgeFunction(fnMap[type], {
          body: { order_id: id },
        })
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed')
        if (type === 'cancel' && data.stock_restored) toast.success('Order cancelled — stock restored')
      }
      
      if (type !== 'cancel' || !msgMap['cancel'].includes('restored')) {
        toast.success(msgMap[type])
      }
      setDialog(null)
      await fetchOrder()
    } catch (err: any) { toast.error(err.message) }
    finally { setActionLoading(false) }
  }

  const doInvoice = async () => {
    setActionLoading(true)
    setInvoiceUrl('')
    // Save company name for future use
    if (companyName.trim()) localStorage.setItem('blast-company-name', companyName.trim())
    try {
      const { data, error } = await invokeEdgeFunction('inv_generate_invoice', {
        body: { order_id: id, company_name: companyName.trim() || undefined },
      })
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed')
      setInvoiceUrl(data.url)
    } catch (err: any) { toast.error(err.message); setDialog(null) }
    finally { setActionLoading(false) }
  }

  const openDialog = (type: DialogType) => {
    setDialog(type)
    if (type === 'invoice') {
      // Don't auto-generate — let user enter company name first
      setInvoiceUrl('')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" />
    </div>
  )

  if (!order) return null

  const statusSteps = ['draft', 'confirmed', 'delivered']
  const currentStep = statusSteps.indexOf(order.status)

  // Compute discount display
  const discountAmt = Number(order.discount_value || 0)
  const itemsTotal = items.reduce((s, i) => s + Number(i.total_price || 0), 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/orders')} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">{order.order_number}</h1>
          <p className="text-sm text-text-secondary mt-1">Created {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {order.status === 'draft' && (
            <>
              <button onClick={() => openDialog('confirm')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-cta hover:bg-cta-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                <CheckCircle className="w-4 h-4" /> Confirm
              </button>
              <button onClick={() => openDialog('cancel')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 border border-error text-error text-sm font-medium rounded-xl hover:bg-error-light transition-colors disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            </>
          )}
          {order.status === 'confirmed' && (
            <>
              <button onClick={() => openDialog('deliver')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                <Truck className="w-4 h-4" /> Mark Delivered
              </button>
              <button onClick={() => openDialog('invoice')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200 disabled:opacity-50">
                <FileText className="w-4 h-4" /> Generate Invoice
              </button>
              <button onClick={() => openDialog('cancel')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 border border-error/50 text-error text-xs font-medium rounded-xl hover:bg-error-light transition-colors disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            </>
          )}
          {order.status === 'delivered' && (
            <button onClick={() => openDialog('invoice')} disabled={actionLoading} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200 disabled:opacity-50">
              <Download className="w-4 h-4" /> Download Invoice
            </button>
          )}
        </div>
      </div>

      {/* Order info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {order.customer_name && (
          <div className="neu-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cta/10 text-primary flex items-center justify-center"><User className="w-4 h-4" /></div>
            <div><p className="text-[11px] text-text-tertiary uppercase font-medium">Customer</p><p className="text-sm font-medium">{order.customer_name}</p></div>
          </div>
        )}
        {order.payment_method && (
          <div className="neu-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-info-light text-info flex items-center justify-center"><CreditCard className="w-4 h-4" /></div>
            <div><p className="text-[11px] text-text-tertiary uppercase font-medium">Payment</p><p className="text-sm font-medium">{order.payment_method}</p></div>
          </div>
        )}
        {discountAmt > 0 && (
          <div className="neu-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-success-light text-success flex items-center justify-center"><span className="text-sm font-bold">%</span></div>
            <div><p className="text-[11px] text-text-tertiary uppercase font-medium">Discount</p><p className="text-sm font-medium text-success">-{formatCurrency(discountAmt)}</p></div>
          </div>
        )}
      </div>

      {/* Status timeline */}
      <div className="neu-card p-5">
        <div className="flex items-center justify-between">
          {statusSteps.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  order.status === 'cancelled' ? 'bg-error-light text-error' :
                  i <= currentStep ? 'bg-cta text-white' : 'bg-background-alt text-text-tertiary'
                )}>
                  {i + 1}
                </div>
                <span className="text-xs text-text-secondary mt-1 capitalize">{step}</span>
              </div>
              {i < statusSteps.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-2', i < currentStep ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
        {order.status === 'cancelled' && (
          <p className="text-center text-error text-sm font-medium mt-3">This order was cancelled</p>
        )}
      </div>

      {/* Items */}
      <div className="neu-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-heading font-semibold">Order Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-background-alt">
              <th className="text-left py-3 px-5 font-medium text-text-secondary">Product</th>
              <th className="text-left py-3 px-5 font-medium text-text-secondary">Cases</th>
              <th className="text-left py-3 px-5 font-medium text-text-secondary">Pcs/Case</th>
              <th className="text-left py-3 px-5 font-medium text-text-secondary">Total Pcs</th>
              <th className="text-left py-3 px-5 font-medium text-text-secondary">Unit Price</th>
              <th className="text-right py-3 px-5 font-medium text-text-secondary">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-border/50 last:border-0">
                <td className="py-3 px-5">
                  <p className="font-medium">{(item.blast_products as any)?.name || 'Unknown'}</p>
                  <p className="text-xs text-text-tertiary font-mono">{(item.blast_products as any)?.sku}</p>
                </td>
                <td className="py-3 px-5 font-mono">{item.cases_ordered}</td>
                <td className="py-3 px-5 font-mono text-text-secondary">{item.pieces_per_case_snapshot}</td>
                <td className="py-3 px-5 font-mono">{item.computed_pieces}</td>
                <td className="py-3 px-5 font-mono">{formatCurrency(Number(item.unit_price_piece_snapshot))}</td>
                <td className="py-3 px-5 font-mono text-right font-medium">{formatCurrency(Number(item.total_price))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {discountAmt > 0 && (
              <>
                <tr className="border-t border-border/50">
                  <td colSpan={5} className="py-2 px-5 text-right text-sm text-text-secondary">Subtotal</td>
                  <td className="py-2 px-5 font-mono text-right">{formatCurrency(itemsTotal)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="py-2 px-5 text-right text-sm text-success">Discount</td>
                  <td className="py-2 px-5 font-mono text-right text-success">-{formatCurrency(discountAmt)}</td>
                </tr>
              </>
            )}
            <tr className="bg-background-alt">
              <td colSpan={5} className="py-3 px-5 font-semibold text-right">Total</td>
              <td className="py-3 px-5 font-mono font-bold text-right text-lg">{formatCurrency(Number(order.total_amount))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Action Dialogs */}
      {dialog && dialog !== 'invoice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg">
                {dialog === 'confirm' ? 'Confirm Order' : dialog === 'deliver' ? 'Mark as Delivered' : 'Cancel Order'}
              </h2>
              <button onClick={() => setDialog(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 text-center">
              <div className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4',
                dialog === 'cancel' ? 'bg-error-light' : dialog === 'confirm' ? 'bg-cta/10' : 'bg-success-light'
              )}>
                {dialog === 'cancel' ? <AlertTriangle className="w-7 h-7 text-error" /> :
                 dialog === 'confirm' ? <CheckCircle className="w-7 h-7 text-cta" /> :
                 <Truck className="w-7 h-7 text-success" />}
              </div>
              <p className="font-medium mb-1">
                {dialog === 'confirm' ? 'Confirm this order?' : dialog === 'deliver' ? 'Mark order as delivered?' : 'Cancel this order?'}
              </p>
              <p className="text-sm text-text-secondary">
                {dialog === 'confirm' ? 'Stock will be deducted from inventory. This action cannot be undone.' :
                 dialog === 'deliver' ? 'This marks the order as completed and delivered to the customer.' :
                 order.status === 'confirmed' ? 'Stock will be restored to inventory since this order was confirmed.' :
                 'This draft order will be cancelled.'}
              </p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setDialog(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">
                Go Back
              </button>
              <button
                onClick={() => doAction(dialog as 'confirm' | 'deliver' | 'cancel')}
                disabled={actionLoading}
                className={cn(
                  'flex-1 h-10 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2',
                  dialog === 'cancel' ? 'bg-error hover:bg-error/90' : dialog === 'confirm' ? 'bg-primary hover:bg-cta-dark' : 'bg-success hover:bg-success/90'
                )}
              >
                {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                  dialog === 'confirm' ? 'Confirm' : dialog === 'deliver' ? 'Mark Delivered' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Dialog */}
      {dialog === 'invoice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-cta" /> Invoice
              </h2>
              <button onClick={() => setDialog(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {actionLoading ? (
                <div className="py-8 text-center">
                  <div className="w-8 h-8 border-2 border-cta/30 border-l-cta rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">Generating invoice PDF...</p>
                </div>
              ) : invoiceUrl ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-success" />
                  </div>
                  <p className="font-medium mb-1">Invoice Ready</p>
                  <p className="text-sm text-text-secondary mb-6">PDF generated for order {order.order_number}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDialog(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">
                      Close
                    </button>
                    <button
                      onClick={() => {
                        const w = window.open(invoiceUrl, '_blank')
                        if (w) { w.onload = () => { setTimeout(() => w.print(), 500) } }
                      }}
                      className="flex-1 h-10 rounded-xl border border-cta text-primary text-sm font-medium hover:bg-cta/10 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button onClick={() => window.open(invoiceUrl, '_blank')} className="flex-1 h-10 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Company Name <span className="text-text-tertiary font-normal">(optional)</span></label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. BLAST Trading Corp."
                    />
                    <p className="text-xs text-text-tertiary mt-1">This will appear at the top of the invoice PDF. Your choice is remembered.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setDialog(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">
                      Cancel
                    </button>
                    <button onClick={doInvoice} className="flex-1 h-10 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" /> Generate Invoice
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
