import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Check } from 'lucide-react'

interface Option {
  value: string
  label: string
  icon?: React.ReactNode
  sublabel?: string
}

interface CustomSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  compact?: boolean
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...', className, compact }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl bg-surface text-left transition-all duration-200',
          'neu-input',
          compact ? 'h-9 px-3 text-xs' : 'h-11 px-3.5 text-sm',
          open && 'border-cta shadow-[var(--shadow-neu-inset),0_0_0_3px_rgb(3_105_161/0.15)]'
        )}
      >
        <span className={cn('truncate', !selected && 'text-text-tertiary')}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.icon}
              {selected.label}
            </span>
          ) : placeholder}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-text-tertiary shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[180px] max-h-[240px] overflow-y-auto rounded-xl bg-surface shadow-[var(--shadow-lg)] animate-fade-in border border-border/50">
          <div className="p-1.5">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                  opt.value === value
                    ? 'bg-cta/10 text-cta font-medium'
                    : 'text-text-primary hover:bg-background-alt'
                )}
              >
                <span className="flex-1 flex items-center gap-2 truncate text-left">
                  {opt.icon}
                  <span className="truncate">
                    {opt.label}
                    {opt.sublabel && <span className="block text-[10px] text-text-tertiary font-normal">{opt.sublabel}</span>}
                  </span>
                </span>
                {opt.value === value && <Check className="w-3.5 h-3.5 text-cta shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
