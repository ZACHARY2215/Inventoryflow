import { useState } from 'react'
import { Bell, Check, Trash2, AlertTriangle, ShoppingCart, FileText, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import usePageTitle from '@/hooks/usePageTitle'

interface Notification {
  id: string; type: string; title: string; message: string
  read: boolean; priority: 'low' | 'normal' | 'high' | 'urgent'; created_at: string
}

// Placeholder notifications until the notification system is wired
const sampleNotifications: Notification[] = [
  { id: '1', type: 'low_stock', title: 'Low Stock Alert', message: 'Several products are below the minimum threshold', read: false, priority: 'high', created_at: new Date().toISOString() },
  { id: '2', type: 'order', title: 'Order Confirmed', message: 'ORD-2026-12345 has been confirmed', read: false, priority: 'normal', created_at: new Date().toISOString() },
  { id: '3', type: 'return', title: 'New Return Request', message: 'A new return request needs your approval', read: true, priority: 'normal', created_at: new Date().toISOString() },
]

export default function Notifications() {
  usePageTitle('Notifications')
  const [notifications, setNotifications] = useState(sampleNotifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filtered = notifications.filter(n => filter === 'all' || !n.read)
  const unread = notifications.filter(n => !n.read).length

  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const remove = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id))

  const iconMap: Record<string, React.ElementType> = { low_stock: AlertTriangle, order: ShoppingCart, invoice: FileText, return: RotateCcw }
  const colorMap: Record<string, string> = { urgent: 'text-error bg-error-light', high: 'text-warning bg-warning-light', normal: 'text-info bg-info-light', low: 'text-text-tertiary bg-background-alt' }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-text-cta">Notifications</h1><p className="text-sm text-text-secondary mt-1">{unread} unread</p></div>
        {unread > 0 && <button onClick={markAllRead} className="text-sm text-primary hover:text-cta-dark font-medium">Mark all as read</button>}
      </div>

      <div className="flex gap-1.5">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-2 rounded-xl text-sm font-medium transition-colors capitalize', filter === f ? 'bg-cta text-white' : 'bg-surface border border-border text-text-secondary hover:bg-background-alt')}>
            {f === 'all' ? `All (${notifications.length})` : `Unread (${unread})`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="neu-card py-16 text-center">
            <Bell className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary font-medium">No notifications</p>
          </div>
        ) : filtered.map(n => {
          const Icon = iconMap[n.type] || Bell
          const color = colorMap[n.priority] || colorMap.normal
          return (
            <div key={n.id} className={cn('neu-card p-4 flex items-start gap-3 transition-colors', !n.read && 'border-l-4 border-l-cta')}>
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}><Icon className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
                <p className="text-[10px] text-text-tertiary mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1">
                {!n.read && <button onClick={() => markRead(n.id)} className="p-1.5 rounded-md hover:bg-background-alt text-text-tertiary" title="Mark as read"><Check className="w-3.5 h-3.5" /></button>}
                <button onClick={() => remove(n.id)} className="p-1.5 rounded-md hover:bg-error-light text-text-tertiary hover:text-error" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
