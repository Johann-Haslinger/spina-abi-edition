import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { SessionWidget } from '../features/session'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition',
      isActive
        ? 'text-black dark:text-white bg-black/5 dark:bg-white/10'
        : 'text-black dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10',
    )

    
export function NavBar() {
  return (
    <header className="backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3">
          <div className="justify-self-start flex font-semibold items-center gap-3">
           Spina
          </div>

          <nav className="justify-self-center flex items-center gap-2">
            <NavLink to="/dashboard" className={navLinkClass}>
             
              Dashboard
            </NavLink>
            <NavLink to="/collection" className={navLinkClass}>
                Sammlung
            </NavLink>
            <NavLink to="/calendar" className={navLinkClass}>
                Kalender
            </NavLink>
           
          </nav>
          <div className="justify-self-end">
            <SessionWidget />
          </div>
        </div>
      
      </header>
  )
}

