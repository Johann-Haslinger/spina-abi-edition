import clsx from 'clsx'
import { BookOpen, CalendarDays, FolderOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
      isActive
        ? 'bg-slate-800 text-slate-50'
        : 'text-slate-200 hover:bg-slate-900 hover:text-slate-50',
    )

    
export function NavBar() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-slate-50">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-50">
                Abi Lernen
              </div>
              <div className="text-xs text-slate-400">Sammlung & Uploads</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink to="/dashboard" className={navLinkClass}>
              <BookOpen className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink to="/collection" className={navLinkClass}>
              <FolderOpen className="h-4 w-4" />
              Collection
            </NavLink>
            <span
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-500"
              title="Kalender kommt als nächstes"
            >
              <CalendarDays className="h-4 w-4" />
              Kalender
            </span>
          </nav>
        </div>
      </header>
  )
}

