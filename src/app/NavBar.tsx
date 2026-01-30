import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { SessionWidget } from '../features/session';
import { ThemeToggle } from './ThemeToggle';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition',
    isActive
      ? 'text-black dark:text-white'
      : 'text-black dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10',
  );

export function NavBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 xl:px-8 py-4">
        <div className="justify-self-start flex font-bold items-center pt-2 gap-3 text-xl">
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
        <div className="justify-self-end flex items-center gap-2">
          <ThemeToggle />
          <SessionWidget />
        </div>
      </div>
    </header>
  );
}
