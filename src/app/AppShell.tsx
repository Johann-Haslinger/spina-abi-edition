import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useThemeDomSync } from '../ui/hooks/useThemeDomSync';
import { NavBar } from './NavBar';

const LAST_ROUTE_STORAGE_KEY = 'mathe-abi-2026:lastRoute';

export function AppShell() {
  useThemeDomSync();

  const location = useLocation();
  useEffect(() => {
    // Persist the current route so it survives a full quit/restart.
    // We exclude "/" because it's just an entry-point redirect.
    if (location.pathname === '/') return;
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    localStorage.setItem(LAST_ROUTE_STORAGE_KEY, fullPath);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="min-h-screen">
      <NavBar />

      <main className="mx-auto max-w-220 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
