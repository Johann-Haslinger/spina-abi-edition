import { Outlet } from 'react-router-dom';
import { useThemeDomSync } from '../ui/hooks/useThemeDomSync';
import { usePersistLastRoute } from './hooks/usePersistLastRoute';
import { NavBar } from './NavBar';
import { NotificationCenter } from './NotificationCenter';

export function AppShell() {
  useThemeDomSync();
  usePersistLastRoute();

  return (
    <div className="h-full">
      <NavBar />
      <NotificationCenter />

      <main className="mx-auto xl:w-4/5 px-16 h-full">
        <Outlet />
      </main>
    </div>
  );
}
