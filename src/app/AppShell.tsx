import { Outlet } from 'react-router-dom';
import { useThemeDomSync } from '../ui/hooks/useThemeDomSync';
import { NavBar } from './NavBar';
import { usePersistLastRoute } from './hooks/usePersistLastRoute';

export function AppShell() {
  useThemeDomSync();
  usePersistLastRoute();

  return (
    <div className="min-h-screen">
      <NavBar />

      <main className="mx-auto max-w-4xl">
        <Outlet />
      </main>
    </div>
  );
}
