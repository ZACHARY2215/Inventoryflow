import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { FileText, Search, Download } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface Invoice { id: string; invoice_number: string; order_id: string; pdf_url: string; created_at: string }

export default function Invoices() {
  usePageTitle('Invoices')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await apiFetch<Invoice[]>('/api/query', {
        method: 'POST',
        body: JSON.stringify({
          table: 'blast_invoices',
          order: { column: 'created_at', ascending: false }
        })
      })
      setInvoices(data || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch invoices')
    } finally {
      setLoading(false)
    }
  }

  const filtered = invoices.filter(i => i.invoice_number.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-text-cta">Invoices</h1><p className="text-sm text-text-secondary mt-1">View and download generated invoices</p></div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" /><input type="text" placeholder="Search by invoice number..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} /></div>

      <div className="neu-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
        filtered.length === 0 ? <div className="text-center py-16"><FileText className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" /><p className="text-text-secondary font-medium">No invoices yet</p></div> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/50 bg-background-alt">
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Invoice #</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Date</th>
              <th className="text-right py-3 px-4 font-medium text-text-secondary">Actions</th>
            </tr></thead>
            <tbody>{filtered.map(inv => (
              <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-background-alt/50">
                <td className="py-3 px-4 font-mono font-medium">{inv.invoice_number}</td>
                <td className="py-3 px-4 text-text-secondary text-xs">{formatDateTime(inv.created_at)}</td>
                <td className="py-3 px-4 text-right">
                  <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-background-alt transition-all duration-200">
                    <Download className="w-3 h-3" /> Download
                  </a>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </div>
    </div>
  )
}
