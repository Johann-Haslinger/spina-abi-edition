import { Navigate } from 'react-router-dom';
import { LAST_ROUTE_STORAGE_KEY } from './lastRouteStorage';

export function LastVisitedRedirect() {
  const stored =
    typeof window === 'undefined' ? null : window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
  const to = stored && stored.startsWith('/') && stored !== '/' ? stored : '/dashboard';

  return <Navigate to={to} replace />;
}
