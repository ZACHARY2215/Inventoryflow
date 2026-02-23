import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function piecesToCasesAndPieces(pieces: number, piecesPerCase: number): string {
  const cases = Math.floor(pieces / piecesPerCase)
  const remaining = pieces % piecesPerCase
  if (cases === 0) return `${remaining} pcs`
  if (remaining === 0) return `${cases} case${cases > 1 ? 's' : ''}`
  return `${cases} case${cases > 1 ? 's' : ''} + ${remaining} pc${remaining > 1 ? 's' : ''}`
}

export function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const seq = Math.floor(10000 + Math.random() * 90000)
  return `ORD-${year}-${seq}`
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  const seq = Math.floor(10000 + Math.random() * 90000)
  return `INV-${year}-${seq}`
}

export function generateReturnNumber(): string {
  const year = new Date().getFullYear()
  const seq = Math.floor(10000 + Math.random() * 90000)
  return `RET-${year}-${seq}`
}

// CSV Export
export function exportToCsv(filename: string, rows: Record<string, any>[], columns?: { key: string; label: string }[]) {
  if (rows.length === 0) return
  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }))
  const header = cols.map(c => `"${c.label}"`).join(',')
  const body = rows.map(row =>
    cols.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return '""'
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  ).join('\n')
  const csv = `${header}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.click()
  URL.revokeObjectURL(url)
}
