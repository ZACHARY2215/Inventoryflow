import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Factory, Plus, Search, Edit2, Trash2, X, Save, Phone, Mail, MapPin, User } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Supplier {
  id: string; name: string; warehouse_name: string | null; contact_person: string | null
  phone: string | null; email: string | null; address: string | null; is_active: boolean; created_at: string
}

export default function Suppliers() {
  usePageTitle('Suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', warehouse_name: '', contact_person: '', phone: '', email: '', address: '' })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('blast_suppliers').select('*').order('name')
    if (error) { toast.error(error.message); setLoading(false); return }
    setSuppliers(data || [])
    setLoading(false)
  }

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.contact_person || '').toLowerCase().includes(search.toLowerCase()))

  const openCreate = () => { setEditItem(null); setForm({ name: '', warehouse_name: '', contact_person: '', phone: '', email: '', address: '' }); setShowForm(true) }
  const openEdit = (s: Supplier) => { setEditItem(s); setForm({ name: s.name, warehouse_name: s.warehouse_name || '', contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '' }); setShowForm(true) }

  const handleSave = async () => {
    if (!form.name) { toast.error('Supplier name is required'); return }
    const payload = { name: form.name.trim(), warehouse_name: form.warehouse_name.trim() || null, contact_person: form.contact_person.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null }
    if (editItem) {
      const { error } = await supabase.from('blast_suppliers').update(payload).eq('id', editItem.id)
      if (error) { toast.error(error.message); return }
      toast.success('Supplier updated')
    } else {
      const { error } = await supabase.from('blast_suppliers').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Supplier created')
    }
    setShowForm(false); load()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.from('blast_suppliers').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-text-cta">Suppliers</h1><p className="text-sm text-text-secondary mt-1">Manage supplier information</p></div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-cta hover:bg-cta-dark text-white text-sm font-medium rounded-lg transition-colors"><Plus className="w-4 h-4" /> Add Supplier</button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input type="text" placeholder="Search suppliers..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
      filtered.length === 0 ? <div className="neu-card py-16 text-center"><Factory className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" /><p className="text-text-secondary font-medium">No suppliers found</p></div> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="neu-card p-5 hover:shadow-[var(--shadow-neu-hover)] hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <div><h3 className="font-heading font-semibold">{s.name}</h3>{s.warehouse_name && <p className="text-xs text-text-tertiary">{s.warehouse_name}</p>}</div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-background-alt text-text-tertiary"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 rounded-md hover:bg-error-light text-text-tertiary hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-text-secondary">
              {s.contact_person && <div className="flex items-center gap-1.5"><User className="w-3 h-3" />{s.contact_person}</div>}
              {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.phone}</div>}
              {s.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{s.email}</div>}
              {s.address && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{s.address}</div>}
            </div>
          </div>
        ))}
      </div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="bg-surface rounded-xl border shadow-xl w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border"><h2 className="font-heading font-semibold text-lg">{editItem ? 'Edit Supplier' : 'New Supplier'}</h2><button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1.5">Supplier Name *</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><label className="block text-sm font-medium mb-1.5">Warehouse/Location</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.warehouse_name} onChange={e => setForm({...form, warehouse_name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1.5">Contact Person</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1.5">Phone</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1.5">Email</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="block text-sm font-medium mb-1.5">Address</label><input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-background-alt">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium inline-flex items-center gap-2"><Save className="w-4 h-4" /> {editItem ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
