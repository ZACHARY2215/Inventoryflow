import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export default function Dialog({ open, onClose, title, icon, children, footer, maxWidth = 'md' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      document.addEventListener('keydown', handler)
      return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handler) }
    } else {
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop — stagger: appears first */}
      <div className="absolute inset-0 bg-primary/30 backdrop-blur-[3px] animate-fade-in" />

      {/* Panel — stagger: scale in after backdrop */}
      <div className={cn(
        'relative w-full mx-auto bg-surface rounded-2xl shadow-[var(--shadow-xl)]',
        'modal-scale-in',
        widths[maxWidth]
      )}>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2.5">
              {icon}
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-background-alt text-text-tertiary hover:text-text-primary transition-all duration-200 hover:shadow-[var(--shadow-xs)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex gap-3 px-6 py-4 border-t border-border/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ConfirmDialog — shorthand for destructive confirmations */
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string | React.ReactNode
  icon?: React.ReactNode
  confirmLabel?: string
  confirmVariant?: 'danger' | 'warning' | 'primary'
  loading?: boolean
}

const variantClasses = {
  danger: 'bg-error hover:bg-error/90 text-white shadow-[0_4px_14px_-3px_rgb(220_38_38/0.4)]',
  warning: 'bg-warning hover:bg-warning/90 text-white shadow-[0_4px_14px_-3px_rgb(217_119_6/0.4)]',
  primary: 'bg-cta hover:bg-cta-dark text-white shadow-[0_4px_14px_-3px_rgb(3_105_161/0.4)]',
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, icon, confirmLabel = 'Confirm', confirmVariant = 'danger', loading,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <div className="text-center">
        {icon && (
          <div className="w-14 h-14 rounded-2xl bg-background-alt flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-neu-inset)]">
            {icon}
          </div>
        )}
        <p className="font-heading font-semibold text-lg">{title}</p>
        <div className="text-sm text-text-secondary mt-2">{description}</div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-background-alt transition-all duration-200 hover:shadow-[var(--shadow-xs)]"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'flex-1 h-11 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 inline-flex items-center justify-center gap-2',
            'hover:translate-y-[-1px]',
            variantClasses[confirmVariant]
          )}
        >
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-l-white rounded-full animate-spin" /> : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
