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
        className="inline-flex items-center gap-2 rounded-full bg-black/85 hover:bg-black text-white dark:text-black dark:bg-white/90 dark:hover:bg-white pl-3 pr-4 py-1.5 text-xs cursor-pointer transition-all"
      >
        <Play className="h-4 w-4" />
        Lernen
      </button>

      <StartSessionModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

