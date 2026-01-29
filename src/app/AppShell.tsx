import { Outlet } from 'react-router-dom';
import { useThemeDomSync } from '../ui/hooks/useThemeDomSync';
import { NavBar } from './NavBar';

export function AppShell() {
  useThemeDomSync();

  return (
    <div className="min-h-screen">
      <NavBar />

      <main className="mx-auto max-w-220 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
