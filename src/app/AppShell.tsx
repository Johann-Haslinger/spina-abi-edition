import { Outlet, useMatches } from 'react-router-dom';
import { useThemeDomSync } from '../ui/hooks/useThemeDomSync';
import { useAppSurfaceTheme } from '../ui/hooks/useAppSurfaceTheme';
import { usePageSurfaceTheme } from '../ui/hooks/useSubjectColors';
import { usePersistLastRoute } from './hooks/usePersistLastRoute';
import { NavBar } from './NavBar';
import { NotificationCenter } from './NotificationCenter';

export function AppShell() {
  useThemeDomSync();
  usePersistLastRoute();
  const matches = useMatches();
  const subjectId =
    [...matches].reverse().find((match) => typeof match.params.subjectId === 'string')?.params
      .subjectId ?? null;
  const pageSurfaceTheme = usePageSurfaceTheme(subjectId);
  useAppSurfaceTheme(pageSurfaceTheme);

  return (
    <div className="h-full" style={{ backgroundColor: pageSurfaceTheme.pageBackground }}>
      <NavBar />
      <NotificationCenter />

      <main
        className="mx-auto h-full"
        style={{ backgroundColor: pageSurfaceTheme.pageBackground }}
      >
        <Outlet />
      </main>
    </div>
  );
}
