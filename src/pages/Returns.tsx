import { useEffect, useState } from 'react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { RotateCcw, Search, CheckCircle, XCircle, Clock } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

export default function Returns() {
  usePageTitle('Returns')
  const { isAdmin } = useAuth()
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [actionDialog, setActionDialog] = useState<{ id: string; action: 'approve' | 'reject'; returnNumber: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('blast_returns').select('*').order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setReturns(data || [])
    setLoading(false)
  }

  const handleAction = async () => {
    if (!actionDialog) return
    setActionLoading(true)
    try {
      const { data, error } = await invokeEdgeFunction('inv_process_return', {
        body: { return_id: actionDialog.id, action: actionDialog.action },
      })
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed')
      const msg = actionDialog.action === 'approve'
        ? `Return approved${data.pieces_restored ? ` — ${data.pieces_restored} pcs restored` : ''}`
        : 'Return rejected'
      toast.success(msg)
      setActionDialog(null)
      load()
    } catch (err: any) { toast.error(err.message) }
    finally { setActionLoading(false) }
  }

  const filtered = returns.filter(r => {
    const matchSearch = r.return_number.toLowerCase().includes(search.toLowerCase()) || r.reason.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filter === 'all' || r.status === filter)
  })

  const statusConfig: Record<string, { icon: React.ElementType; className: string }> = {
    pending: { icon: Clock, className: 'bg-warning-light text-warning' },
    approved: { icon: CheckCircle, className: 'bg-success-light text-success' },
    rejected: { icon: XCircle, className: 'bg-error-light text-error' },
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-text-cta">Returns</h1><p className="text-sm text-text-secondary mt-1">Manage return requests and approvals</p></div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" /><input type="text" placeholder="Search returns..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="flex gap-1.5">
          {['all', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={cn('px-3 py-2 rounded-xl text-sm font-medium transition-colors capitalize', filter === s ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="neu-card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
        filtered.length === 0 ? <div className="text-center py-16"><RotateCcw className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" /><p className="text-text-secondary font-medium">No returns found</p></div> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/50 bg-background-alt">
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Return #</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Reason</th>
              <th className="text-left py-3 px-4 font-medium text-text-secondary">Date</th>
              {isAdmin && <th className="text-right py-3 px-4 font-medium text-text-secondary">Actions</th>}
            </tr></thead>
            <tbody>{filtered.map(r => {
              const sc = statusConfig[r.status] || statusConfig.pending
              const Icon = sc.icon
              return (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-background-alt/50">
                  <td className="py-3 px-4 font-mono font-medium">{r.return_number}</td>
                  <td className="py-3 px-4"><span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', sc.className)}><Icon className="w-3 h-3" /> {r.status}</span></td>
                  <td className="py-3 px-4 text-text-secondary max-w-xs truncate">{r.reason}</td>
                  <td className="py-3 px-4 text-text-secondary text-xs">{formatDateTime(r.created_at)}</td>
                  {isAdmin && <td className="py-3 px-4 text-right">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setActionDialog({ id: r.id, action: 'approve', returnNumber: r.return_number })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-success-light text-success hover:bg-success/20 transition-colors">Approve</button>
                        <button onClick={() => setActionDialog({ id: r.id, action: 'reject', returnNumber: r.return_number })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-error-light text-error hover:bg-error/20 transition-colors">Reject</button>
                      </div>
                    )}
                  </td>}
                </tr>
              )
            })}</tbody>
          </table>
        </div>}
      </div>
      {/* Action Confirmation Dialog */}
      {actionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 text-center">
              <div className={cn('w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4', actionDialog.action === 'approve' ? 'bg-success-light' : 'bg-error-light')}>
                {actionDialog.action === 'approve' ? <CheckCircle className="w-7 h-7 text-success" /> : <XCircle className="w-7 h-7 text-error" />}
              </div>
              <p className="font-medium mb-1">{actionDialog.action === 'approve' ? 'Approve Return?' : 'Reject Return?'}</p>
              <p className="text-sm text-text-secondary">
                {actionDialog.action === 'approve' ? 'This will restore inventory and mark as approved.' : 'This will permanently reject the return request.'}
              </p>
              <p className="text-xs font-mono text-text-tertiary mt-1">{actionDialog.returnNumber}</p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setActionDialog(null)} disabled={actionLoading} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">Cancel</button>
              <button onClick={handleAction} disabled={actionLoading} className={cn('flex-1 h-10 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2', actionDialog.action === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-error hover:bg-error/90')}>
                {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
