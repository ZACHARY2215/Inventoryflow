import { Printer } from 'lucide-react'

interface PrintButtonProps {
  title?: string
  className?: string
}

export default function PrintButton({ title = 'Print', className = '' }: PrintButtonProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className={`inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200 ${className}`}
      title={title}
    >
      <Printer className="w-4 h-4" /> Print
    </button>
  )
}
