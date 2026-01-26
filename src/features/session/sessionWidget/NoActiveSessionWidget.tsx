import { Play } from 'lucide-react'
import { useState } from 'react'
import { StartSessionModal } from './StartSessionModal'

export function NoActiveSessionWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        <Play className="h-4 w-4" />
        Session starten
      </button>

      <StartSessionModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

