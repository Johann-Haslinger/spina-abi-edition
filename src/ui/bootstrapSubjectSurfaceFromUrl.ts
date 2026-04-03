import { useThemeStore } from '../stores/themeStore';
import { readCachedSubject } from './subjectThemeCache';
import { resolveSubjectSurfaceTheme } from './subjectThemeSurfaces';

const ACTIVE_SESSION_STORAGE_KEY = 'mathe-abi-2026:active-session';

function readActiveSessionSubjectId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { active?: { subjectId?: string } | null } };
    const id = parsed.state?.active?.subjectId;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

function parseStudySubjectIdFromPathname(pathname: string): string | null {
  const prefix = '/study/';
  if (!pathname.startsWith(prefix)) return null;
  const segments = pathname.slice(prefix.length).split('/').filter(Boolean);
  if (segments.length >= 2) return segments[0] ?? null;
  if (segments.length === 1) return readActiveSessionSubjectId();
  return null;
}

function applySurfaceThemeToDom(surfaceTheme: ReturnType<typeof resolveSubjectSurfaceTheme>) {
  const root = document.documentElement;
  root.style.setProperty('--app-page-bg', surfaceTheme.pageBackground);
  root.style.setProperty('--app-floating-bg', surfaceTheme.floatingBackground);
  root.style.setProperty('--app-floating-solid-bg', surfaceTheme.floatingSolidBackground);
  root.style.setProperty('--app-modal-bg', surfaceTheme.modalBackground);
  root.style.setProperty('--app-modal-theme-color', surfaceTheme.modalThemeColor);
  root.style.setProperty('--app-overlay-bg', surfaceTheme.overlayBackground);
  root.style.setProperty('--app-theme-color', surfaceTheme.themeColor);
  document.body.style.backgroundColor = surfaceTheme.pageBackground;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', surfaceTheme.themeColor);
}

/**
 * Runs before React paint so iOS Safari / iPad can pick up `theme-color` and CSS vars on hard reload.
 */
export function bootstrapSubjectSurfaceFromUrl() {
  if (typeof window === 'undefined') return;
  const subjectId = parseStudySubjectIdFromPathname(window.location.pathname);
  if (!subjectId) return;
  const cached = readCachedSubject(subjectId);
  if (!cached) return;
  const effectiveTheme = useThemeStore.getState().effectiveTheme;
  const surfaceTheme = resolveSubjectSurfaceTheme(cached.color, effectiveTheme);
  applySurfaceThemeToDom(surfaceTheme);
}

bootstrapSubjectSurfaceFromUrl();
