'use client'

import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${maxWidth} max-h-[85vh] flex flex-col rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl`}>
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
