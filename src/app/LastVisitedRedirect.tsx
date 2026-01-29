import { Navigate } from 'react-router-dom';

const LAST_ROUTE_STORAGE_KEY = 'mathe-abi-2026:lastRoute';

export function LastVisitedRedirect() {
  const stored = localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
  const to = stored && stored.startsWith('/') && stored !== '/' ? stored : '/dashboard';

  return <Navigate to={to} replace />;
}
