import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, formatCurrency, piecesToCasesAndPieces, exportToCsv } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import {
  Package, Plus, Search, Edit2, Trash2, X, Save, Download,
  ChevronDown, AlertTriangle, Upload, Check,
  ToggleLeft, ToggleRight, Tag,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Product {
  id: string; sku: string; name: string; description: string | null
  unit_price_piece: number; wholesale_price_piece: number | null
  pieces_per_case: number
  inventory_pieces: number; reserved_pieces: number
  image_url: string | null; category: string; is_active: boolean
  low_stock_threshold: number; supplier_id: string | null
  created_at: string; updated_at: string
}

interface Supplier {
  id: string; name: string
}

type SortKey = 'name' | 'sku' | 'unit_price_piece' | 'inventory_pieces'
const CATEGORIES = ['Perfume', 'Soap', 'Other']

export default function Products() {
  usePageTitle('Products')
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: string; value: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    sku: '', name: '', description: '', unit_price_piece: '', wholesale_price_piece: '',
    pieces_per_case: '12', category: 'Other', is_active: true, low_stock_threshold: '50',
    supplier_id: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchProducts(); fetchSuppliers() }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const data = await apiFetch<Product[]>('/api/products', { timeoutMs: 15000 })
      setProducts(data || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const data = await apiFetch<Supplier[]>('/api/query', {
        method: 'POST',
        body: JSON.stringify({ table: 'blast_suppliers', select: 'id, name', eq: { is_active: true }, order: { column: 'name', ascending: true } })
      })
      setSuppliers(data || [])
    } catch (error) {}
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = products
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCat = filterCat === 'all' || p.category === filterCat
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? p.is_active : !p.is_active)
      return matchSearch && matchCat && matchStatus
    })
    .sort((a, b) => {
      const v = sortAsc ? 1 : -1
      if (sortKey === 'name' || sortKey === 'sku') return a[sortKey].localeCompare(b[sortKey]) * v
      return (Number(a[sortKey]) - Number(b[sortKey])) * v
    })

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, filterCat, filterStatus])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  const toggleSelectAll = () => {
    if (selected.size === paged.length) setSelected(new Set())
    else setSelected(new Set(paged.map(p => p.id)))
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    const { error } = await supabase.from('blast_products').delete().in('id', [...selected])
    if (error) toast.error(error.message)
    else { toast.success(`${selected.size} product(s) deleted`); setSelected(new Set()); fetchProducts() }
  }

  const saveInlineEdit = async () => {
    if (!inlineEdit) return
    const { id, field, value } = inlineEdit
    const update: Record<string, any> = {}
    if (field === 'name') update.name = value
    else if (field === 'unit_price_piece') update.unit_price_piece = parseFloat(value)
    else if (field === 'low_stock_threshold') update.low_stock_threshold = parseInt(value)
    const { error } = await supabase.from('blast_products').update(update).eq('id', id)
    if (error) toast.error(error.message)
    else { fetchProducts(); toast.success('Updated') }
    setInlineEdit(null)
  }

  const openCreate = () => {
    setEditProduct(null)
    setFormData({ sku: '', name: '', description: '', unit_price_piece: '', wholesale_price_piece: '', pieces_per_case: '12', category: 'Other', is_active: true, low_stock_threshold: '50', supplier_id: '' })
    setImageFile(null); setImagePreview(null)
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setEditProduct(p)
    setFormData({
      sku: p.sku, name: p.name, description: p.description || '',
      unit_price_piece: p.unit_price_piece.toString(),
      wholesale_price_piece: p.wholesale_price_piece?.toString() || '',
      pieces_per_case: p.pieces_per_case.toString(),
      category: p.category || 'Other', is_active: p.is_active ?? true,
      low_stock_threshold: (p.low_stock_threshold || 50).toString(),
      supplier_id: p.supplier_id || '',
    })
    setImageFile(null)
    setImagePreview(p.image_url || null)
    setShowForm(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return editProduct?.image_url || null
    const ext = imageFile.name.split('.').pop()
    const path = `${productId}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true })
    if (error) { toast.error('Image upload failed: ' + error.message); return editProduct?.image_url || null }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!formData.sku || !formData.name || !formData.unit_price_piece || !formData.pieces_per_case) {
      toast.error('Please fill in all required fields'); return
    }
    setSaving(true)
    try {
      const payload = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        unit_price_piece: parseFloat(formData.unit_price_piece),
        wholesale_price_piece: formData.wholesale_price_piece ? parseFloat(formData.wholesale_price_piece) : null,
        pieces_per_case: parseInt(formData.pieces_per_case),
        category: formData.category,
        is_active: formData.is_active,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 50,
        supplier_id: formData.supplier_id || null,
      }
      if (editProduct) {
        const image_url = await uploadImage(editProduct.id)
        const { error } = await supabase.from('blast_products').update({ ...payload, image_url }).eq('id', editProduct.id)
        if (error) throw error
        toast.success('Product updated')
      } else {
        const { data, error } = await supabase.from('blast_products').insert(payload).select().single()
        if (error) throw error
        const image_url = await uploadImage(data.id)
        if (image_url) await supabase.from('blast_products').update({ image_url }).eq('id', data.id)
        toast.success('Product created')
      }
      setShowForm(false)
      fetchProducts()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('blast_products').delete().eq('id', deleteTarget.id)
    if (error) toast.error(error.message)
    else { toast.success('Product deleted'); fetchProducts() }
    setDeleteTarget(null)
  }

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from('blast_products').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) toast.error(error.message)
    else { toast.success(p.is_active ? 'Product deactivated' : 'Product activated'); fetchProducts() }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-cta">Products</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <button
            onClick={() => exportToCsv('products', filtered.map(p => ({
              sku: p.sku, name: p.name, category: p.category, price: p.unit_price_piece,
              stock: p.inventory_pieces, reserved: p.reserved_pieces, status: p.is_active ? 'Active' : 'Inactive'
            })), [
              { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
              { key: 'price', label: 'Price' }, { key: 'stock', label: 'Stock (pcs)' },
              { key: 'reserved', label: 'Reserved' }, { key: 'status', label: 'Status' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {isAdmin && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-cta hover:bg-cta-dark text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search by name or SKU..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {['all', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setFilterCat(c)} className={cn(
              'px-2.5 py-2 rounded-lg text-xs font-medium transition-colors capitalize',
              filterCat === c ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt'
            )}>{c === 'all' ? 'All' : c}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={cn(
              'px-2.5 py-2 rounded-lg text-xs font-medium transition-colors capitalize',
              filterStatus === s ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt'
            )}>{s}</button>
          ))}
        </div>
        <span className="text-sm text-text-tertiary self-center">{filtered.length} products</span>
      </div>

      {/* Table */}
      <div className="neu-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary font-medium">No products found</p>
            <p className="text-sm text-text-tertiary mt-1">
              {search ? 'Try a different search term' : 'Add your first product to get started'}
            </p>
          </div>
        ) : (
          <>
          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-cta/10 border-b border-cta-200 text-sm no-print">
              <span className="font-medium text-cta">{selected.size} selected</span>
              {isAdmin && <button onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error text-white text-xs font-medium hover:bg-error/90"><Trash2 className="w-3 h-3" /> Delete</button>}
              <button onClick={() => setSelected(new Set())} className="text-xs text-text-secondary hover:text-text-cta">Clear</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-background-alt">
                  <th className="py-3 px-4 w-10">
                    <input type="checkbox" checked={selected.size === paged.length && paged.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border accent-cta" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary w-12"></th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <SortHeader label="SKU" sortKey="sku" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortHeader label="Product" sortKey="name" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Category</th>
                  <SortHeader label="Sell/pc" sortKey="unit_price_piece" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  {isAdmin && <th className="text-left py-3 px-4 font-medium text-text-secondary">Cost/pc</th>}
                  <SortHeader label="Stock" sortKey="inventory_pieces" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  {isAdmin && <th className="text-right py-3 px-4 font-medium text-text-secondary no-print">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const threshold = p.low_stock_threshold || p.pieces_per_case * 5
                  const isCritical = p.inventory_pieces < p.pieces_per_case * 2
                  const isLow = p.inventory_pieces < threshold && !isCritical
                  const isOut = p.inventory_pieces <= 0
                  return (
                    <tr key={p.id} className={cn('border-b border-border/50 last:border-0 hover:bg-background-alt/50 transition-all duration-200', !p.is_active && 'opacity-50', selected.has(p.id) && 'bg-cta/10/50')}>
                      <td className="py-3 px-4">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 rounded border-border accent-cta" />
                      </td>
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
                        <div className="flex flex-col gap-1">
                          {isOut ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-error-light text-error uppercase w-fit">Out</span> :
                           isCritical ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-error-light text-error uppercase w-fit">Critical</span> :
                           isLow ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-light text-warning uppercase w-fit">Low</span> :
                           <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-light text-success uppercase w-fit">OK</span>}
                          {!p.is_active && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-background-alt text-text-tertiary uppercase w-fit">Inactive</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-text-secondary">{p.sku}</td>
                      <td className="py-3 px-4">
                        {inlineEdit?.id === p.id && inlineEdit.field === 'name' ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus className="h-7 px-2 rounded border border-cta text-sm w-40" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setInlineEdit(null) }} />
                            <button onClick={saveInlineEdit} className="p-1 text-success"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setInlineEdit(null)} className="p-1 text-error"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <p className="font-medium cursor-pointer hover:text-primary transition-colors" onDoubleClick={() => isAdmin && setInlineEdit({ id: p.id, field: 'name', value: p.name })} title="Double-click to edit">{p.name}</p>
                        )}
                        {p.description && <p className="text-xs text-text-tertiary truncate max-w-[200px]">{p.description}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cta/10 text-cta">{p.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        {inlineEdit?.id === p.id && inlineEdit.field === 'unit_price_piece' ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus type="number" step="0.01" className="h-7 px-2 rounded border border-cta text-sm font-mono w-24" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setInlineEdit(null) }} />
                            <button onClick={saveInlineEdit} className="p-1 text-success"><Check className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <span className="font-mono cursor-pointer hover:text-primary transition-colors" onDoubleClick={() => isAdmin && setInlineEdit({ id: p.id, field: 'unit_price_piece', value: p.unit_price_piece.toString() })} title="Double-click to edit">{formatCurrency(p.unit_price_piece)}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          {p.wholesale_price_piece ? (
                            <div>
                              <span className="font-mono text-text-secondary">{formatCurrency(p.wholesale_price_piece)}</span>
                              <span className="ml-1.5 text-[10px] font-bold text-success">
                                {((p.unit_price_piece - p.wholesale_price_piece) / p.unit_price_piece * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-tertiary">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className={cn('font-mono font-medium', isCritical && 'text-error', isLow && 'text-warning')}>
                          {piecesToCasesAndPieces(p.inventory_pieces, p.pieces_per_case)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right no-print">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => toggleActive(p)} className="p-1.5 rounded-md hover:bg-background-alt text-text-secondary hover:text-text-primary transition-colors" title={p.is_active ? 'Deactivate' : 'Activate'}>
                              {p.is_active ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-background-alt text-text-secondary hover:text-text-primary transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-md hover:bg-error-light text-text-secondary hover:text-error transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
              <h2 className="font-heading font-semibold text-lg">{editProduct ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Product Image</label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-border hover:border-cta cursor-pointer flex items-center justify-center overflow-hidden transition-colors bg-background"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-text-tertiary mx-auto mb-1" />
                        <span className="text-[10px] text-text-tertiary">Upload</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary space-y-1">
                    <p>Click to upload product image</p>
                    <p>JPG, PNG, WebP (max 5MB)</p>
                    {imagePreview && (
                      <button onClick={() => { setImageFile(null); setImagePreview(null) }} className="text-error hover:underline">Remove</button>
                    )}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">SKU *</label>
                  <input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="PRF-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Category</label>
                  <select className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none bg-background" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Product Name *</label>
                <input className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Lavender Perfume 100ml" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Supplier</label>
                <select className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none bg-background" value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                  <option value="">— No supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Sell Price/pc *</label>
                  <input type="number" step="0.01" className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono" value={formData.unit_price_piece} onChange={e => setFormData({...formData, unit_price_piece: e.target.value})} placeholder="150" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Cost/pc (wholesale)</label>
                  <input type="number" step="0.01" className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono" value={formData.wholesale_price_piece} onChange={e => setFormData({...formData, wholesale_price_piece: e.target.value})} placeholder="90" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Pcs/Case *</label>
                  <input type="number" className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono" value={formData.pieces_per_case} onChange={e => setFormData({...formData, pieces_per_case: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Low Stock Threshold</label>
                <input type="number" className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none font-mono" value={formData.low_stock_threshold} onChange={e => setFormData({...formData, low_stock_threshold: e.target.value})} placeholder="50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none resize-none" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional description..." />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background-alt">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium">Active Product</span>
                </div>
                <button onClick={() => setFormData({...formData, is_active: !formData.is_active})} className="relative">
                  {formData.is_active ? <ToggleRight className="w-8 h-8 text-success" /> : <ToggleLeft className="w-8 h-8 text-text-tertiary" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50 sticky bottom-0 bg-surface">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {editProduct ? 'Update' : 'Create'}
              </button>
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
              <p className="font-medium mb-1">Delete Product?</p>
              <p className="text-sm text-text-secondary mb-1">"{deleteTarget.name}" ({deleteTarget.sku})</p>
              <p className="text-xs text-text-tertiary">This action cannot be undone.</p>
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

function SortHeader({ label, sortKey: key, current, asc, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (key: SortKey) => void
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
