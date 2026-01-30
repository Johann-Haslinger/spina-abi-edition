import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LAST_ROUTE_STORAGE_KEY } from '../lastRouteStorage';

export function usePersistLastRoute() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (location.pathname === '/') return;

    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, fullPath);
  }, [location.pathname, location.search, location.hash]);
}
