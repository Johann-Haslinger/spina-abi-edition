import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Modal(props: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const { open, title, onClose, children, footer } = props
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 overflow-y-auto p-4">
        <div className="mx-auto mt-16 w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div className="text-sm font-semibold text-slate-50">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-4">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

