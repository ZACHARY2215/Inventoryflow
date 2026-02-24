import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency, exportToCsv } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import {
  Users, Plus, Search, Edit2, Trash2, X, Save, Phone, Mail,
  MapPin, AlertTriangle, ToggleLeft, ToggleRight, Download,
  Wallet, CreditCard, Hash, CheckCircle,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Customer {
  id: string; name: string; phone: string; email: string | null
  address: string | null; customer_type: string; credit_limit: number
  outstanding_balance: number; is_active: boolean; created_at: string
}

const PAY_METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Check', 'Credit']
const NEEDS_REF = ['GCash', 'Bank Transfer', 'Check', 'Credit']

export default function Customers() {
  usePageTitle('Customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', customer_type: 'walk_in', credit_limit: '0' })
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Payment dialog state
  const [payTarget, setPayTarget] = useState<Customer | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Cash')
  const [payRef, setPayRef] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => { fetch() }, [])

  const fetch = async () => {
    try {
      setLoading(true)
      const data = await apiFetch<Customer[]>('/api/customers', { timeoutMs: 15000 })
      setCustomers(data || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const filtered = customers.filter(c => {
    const match = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    return match && (typeFilter === 'all' || c.customer_type === typeFilter)
  })

  useEffect(() => { setPage(1) }, [search, typeFilter])
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const openCreate = () => { setEditItem(null); setForm({ name: '', phone: '', email: '', address: '', customer_type: 'walk_in', credit_limit: '0' }); setShowForm(true) }
  const openEdit = (c: Customer) => { setEditItem(c); setForm({ name: c.name, phone: c.phone, email: c.email || '', address: c.address || '', customer_type: c.customer_type, credit_limit: c.credit_limit.toString() }); setShowForm(true) }

  const openPay = (c: Customer) => {
    setPayTarget(c)
    setPayAmount('')
    setPayMethod('Cash')
    setPayRef('')
  }

  const handleSave = async () => {
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return }
    const payload = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, address: form.address.trim() || null, customer_type: form.customer_type, credit_limit: parseFloat(form.credit_limit) || 0 }
    if (editItem) {
      const { error } = await supabase.from('blast_customers').update(payload).eq('id', editItem.id)
      if (error) { toast.error(error.message); return }
      toast.success('Customer updated')
    } else {
      const { error } = await supabase.from('blast_customers').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Customer created')
    }
    setShowForm(false); fetch()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('blast_customers').delete().eq('id', deleteTarget.id)
    if (error) toast.error(error.message)
    else { toast.success('Customer deleted'); fetch() }
    setDeleteTarget(null)
  }

  const handlePayment = async () => {
    if (!payTarget) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid payment amount'); return }
    if (amount > payTarget.outstanding_balance) { toast.error(`Amount exceeds balance of ${formatCurrency(payTarget.outstanding_balance)}`); return }
    if (NEEDS_REF.includes(payMethod) && !payRef.trim()) { toast.error(`Reference number required for ${payMethod} payments`); return }
    setPaying(true)
    try {
      const balanceBefore = payTarget.outstanding_balance
      const balanceAfter = Math.max(0, balanceBefore - amount)

      // Update customer balance
      const { error: updateError } = await supabase
        .from('blast_customers')
        .update({ outstanding_balance: balanceAfter })
        .eq('id', payTarget.id)
      if (updateError) throw updateError

      // Log payment record
      const { error: logError } = await supabase
        .from('blast_customer_payments')
        .insert({
          customer_id: payTarget.id,
          amount,
          payment_mode: payMethod,
          reference_number: payRef.trim() || null,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        })
      if (logError) throw logError

      toast.success(`Payment of ${formatCurrency(amount)} recorded for ${payTarget.name}. ${balanceAfter === 0 ? 'Balance fully settled! 🎉' : `Remaining: ${formatCurrency(balanceAfter)}`}`)
      setPayTarget(null)
      fetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setPaying(false)
    }
  }

  const toggleActive = async (c: Customer) => {
    const { error } = await supabase.from('blast_customers').update({ is_active: !c.is_active }).eq('id', c.id)
    if (error) toast.error(error.message)
    else { toast.success(c.is_active ? 'Customer deactivated' : 'Customer activated'); fetch() }
  }

  const types = ['all', 'mall_booth', 'reseller', 'walk_in', 'other']
  const typeLabels: Record<string, string> = { mall_booth: 'Mall Booth', reseller: 'Reseller', walk_in: 'Walk-in', other: 'Other' }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-cta">Customers</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your customer database</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <button
            onClick={() => exportToCsv('customers', filtered.map(c => ({
              name: c.name, phone: c.phone, email: c.email || '', type: typeLabels[c.customer_type] || c.customer_type,
              credit_limit: c.credit_limit, balance: c.outstanding_balance, status: c.is_active ? 'Active' : 'Inactive'
            })), [
              { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
              { key: 'type', label: 'Type' }, { key: 'credit_limit', label: 'Credit Limit' },
              { key: 'balance', label: 'Balance' }, { key: 'status', label: 'Status' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-cta hover:bg-cta-dark text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search by name or phone..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={cn('px-3 py-2 rounded-xl text-sm font-medium transition-colors capitalize', typeFilter === t ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt')}>
              {t === 'all' ? 'All' : typeLabels[t] || t}
            </button>
          ))}
        </div>
      </div>

      <div className="neu-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
        filtered.length === 0 ? <div className="text-center py-16"><Users className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" /><p className="text-text-secondary font-medium">No customers found</p></div> :
        <><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/50 bg-background-alt">
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Name</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Contact</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Type</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Credit Limit</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Balance</th>
              <th className="text-right py-3 px-4 font-medium text-text-secondary">Actions</th>
            </tr></thead>
            <tbody>
              {paged.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-background-alt/50 transition-all duration-200">
                  <td className="py-3 px-4"><Link to={`/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>{c.address && <p className="text-xs text-text-tertiary flex items-center gap-1"><MapPin className="w-3 h-3" />{c.address}</p>}</td>
                  <td className="py-3 px-4"><div className="flex items-center gap-1 text-xs text-text-secondary"><Phone className="w-3 h-3" />{c.phone}</div>{c.email && <div className="flex items-center gap-1 text-xs text-text-tertiary"><Mail className="w-3 h-3" />{c.email}</div>}</td>
                  <td className="py-3 px-4"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-cta/10 text-cta">{typeLabels[c.customer_type] || c.customer_type}</span></td>
                  <td className="py-3 px-4 font-mono">{formatCurrency(c.credit_limit)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono font-medium', c.outstanding_balance > 0 ? 'text-warning' : 'text-text-secondary')}>
                        {formatCurrency(c.outstanding_balance)}
                      </span>
                      {c.outstanding_balance > 0 && (
                        <button
                          onClick={() => openPay(c)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success text-white text-[10px] font-bold uppercase hover:bg-success/90 transition-colors"
                        >
                          <Wallet className="w-2.5 h-2.5" /> Pay
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActive(c)}
                        className={cn('p-1.5 rounded-md transition-colors', c.is_active ? 'text-success hover:bg-success-light' : 'text-text-tertiary hover:bg-background-alt')}
                        title={c.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {c.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-background-alt text-text-secondary hover:text-text-cta"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-md hover:bg-error-light text-text-secondary hover:text-error"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
        </>}
      </div>

      {/* Payment Dialog */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px] p-4">
          <div className="neu-card shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-success" /> Record Payment
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">{payTarget.name}</p>
              </div>
              <button onClick={() => setPayTarget(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Outstanding balance banner */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-warning-light border border-warning/20">
                <span className="text-sm text-warning font-medium">Outstanding Balance</span>
                <span className="font-mono font-bold text-warning text-lg">{formatCurrency(payTarget.outstanding_balance)}</span>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Amount Paid <span className="text-error">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-medium text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payTarget.outstanding_balance}
                    placeholder="0.00"
                    className="w-full h-11 pl-7 pr-4 rounded-xl border border-border text-sm font-mono bg-background focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none text-lg font-bold"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                {payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) <= payTarget.outstanding_balance && (
                  <p className="text-xs text-text-tertiary mt-1">
                    Remaining after payment: <span className={cn("font-mono font-medium", parseFloat(payAmount) >= payTarget.outstanding_balance ? "text-success" : "text-warning")}>
                      {formatCurrency(Math.max(0, payTarget.outstanding_balance - parseFloat(payAmount)))}
                    </span>
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Payment Mode <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {PAY_METHODS.map(m => (
                    <button
                      key={m}
                      onClick={() => { setPayMethod(m); setPayRef('') }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        payMethod === m ? 'bg-cta text-white' : 'bg-background-alt border border-border text-text-secondary hover:bg-border'
                      )}
                    >{m}</button>
                  ))}
                </div>
              </div>

              {/* Reference Number (conditional) */}
              {NEEDS_REF.includes(payMethod) && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Reference No. <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`${payMethod} transaction / reference number`}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-mono focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button
                onClick={() => setPayTarget(null)}
                className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt transition-all duration-200"
              >Cancel</button>
              <button
                onClick={handlePayment}
                disabled={paying || !payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 h-10 rounded-xl bg-success hover:bg-success/90 text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {paying
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle className="w-4 h-4" /> Confirm Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg">{editItem ? 'Edit Customer' : 'New Customer'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1.5">Name *</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1.5">Phone *</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1.5">Email</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1.5">Address</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1.5">Type</label><select className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta outline-none bg-surface" value={form.customer_type} onChange={e => setForm({...form, customer_type: e.target.value})}><option value="walk_in">Walk-in</option><option value="mall_booth">Mall Booth</option><option value="reseller">Reseller</option><option value="other">Other</option></select></div>
                <div><label className="block text-sm font-medium mb-1.5">Credit Limit</label><input type="number" className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-background-alt">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium inline-flex items-center gap-2"><Save className="w-4 h-4" /> {editItem ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-error-light flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-error" />
              </div>
              <p className="font-medium mb-1">Delete Customer?</p>
              <p className="text-sm text-text-secondary">"{deleteTarget.name}"</p>
              <p className="text-xs text-text-tertiary mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">Cancel</button>
              <button onClick={handleDelete} className="flex-1 h-10 rounded-xl bg-error hover:bg-error/90 text-white text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
