import { useEffect, useLayoutEffect, useRef } from 'react';
import type { AppSurfaceTheme } from '../subjectThemeSurfaces';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type SurfaceVarName =
  | '--app-page-bg'
  | '--app-floating-bg'
  | '--app-floating-solid-bg'
  | '--app-modal-bg'
  | '--app-modal-theme-color'
  | '--app-overlay-bg'
  | '--app-theme-color';

const SURFACE_VAR_NAMES: SurfaceVarName[] = [
  '--app-page-bg',
  '--app-floating-bg',
  '--app-floating-solid-bg',
  '--app-modal-bg',
  '--app-modal-theme-color',
  '--app-overlay-bg',
  '--app-theme-color',
];

type RegisteredSurfaceTheme = {
  id: number;
  priority: number;
  surfaceTheme: AppSurfaceTheme;
};

type Snapshot = {
  varValues: Map<SurfaceVarName, string>;
  bodyBackground: string;
  themeColor: string | null;
};

const activeSurfaceThemes = new Map<number, RegisteredSurfaceTheme>();
let nextRegistrationId = 1;
let baseSnapshot: Snapshot | null = null;

function getThemeColorMeta() {
  return document.querySelector('meta[name="theme-color"]');
}

function setThemeColorMeta(color: string) {
  getThemeColorMeta()?.setAttribute('content', color);
}

function resolveThemeColor(color: string) {
  const cssVarMatch = color.match(/^var\((--[^)]+)\)$/);
  if (!cssVarMatch) return color;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(cssVarMatch[1]).trim() || color
  );
}

function applySurfaceTheme(surfaceTheme: AppSurfaceTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--app-page-bg', surfaceTheme.pageBackground);
  root.style.setProperty('--app-floating-bg', surfaceTheme.floatingBackground);
  root.style.setProperty('--app-floating-solid-bg', surfaceTheme.floatingSolidBackground);
  root.style.setProperty('--app-modal-bg', surfaceTheme.modalBackground);
  root.style.setProperty('--app-modal-theme-color', surfaceTheme.modalThemeColor);
  root.style.setProperty('--app-overlay-bg', surfaceTheme.overlayBackground);
  root.style.setProperty('--app-theme-color', surfaceTheme.themeColor);
  document.body.style.backgroundColor = surfaceTheme.pageBackground;
  setThemeColorMeta(surfaceTheme.themeColor);
}

function captureBaseSnapshot(): Snapshot {
  const root = document.documentElement;
  return {
    varValues: new Map(SURFACE_VAR_NAMES.map((name) => [name, root.style.getPropertyValue(name)])),
    bodyBackground: document.body.style.backgroundColor,
    themeColor: getThemeColorMeta()?.getAttribute('content') ?? null,
  };
}

function restoreBaseSnapshot(snapshot: Snapshot) {
  const root = document.documentElement;
  for (const [name, value] of snapshot.varValues) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
  document.body.style.backgroundColor = snapshot.bodyBackground;
  const meta = getThemeColorMeta();
  if (!meta) return;
  if (snapshot.themeColor === null) meta.removeAttribute('content');
  else meta.setAttribute('content', snapshot.themeColor);
}

function getTopSurfaceTheme() {
  let top: RegisteredSurfaceTheme | null = null;
  for (const entry of activeSurfaceThemes.values()) {
    if (
      !top ||
      entry.priority > top.priority ||
      (entry.priority === top.priority && entry.id > top.id)
    ) {
      top = entry;
    }
  }
  return top?.surfaceTheme ?? null;
}

function syncRegisteredSurfaceThemes() {
  if (typeof document === 'undefined') return;
  const topSurfaceTheme = getTopSurfaceTheme();
  if (topSurfaceTheme) {
    applySurfaceTheme(topSurfaceTheme);
    return;
  }
  if (baseSnapshot) restoreBaseSnapshot(baseSnapshot);
}

export function useAppSurfaceTheme(surfaceTheme: AppSurfaceTheme | null | undefined, priority = 0) {
  const registrationIdRef = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    if (!surfaceTheme || typeof document === 'undefined') return;
    if (baseSnapshot === null) baseSnapshot = captureBaseSnapshot();

    const registrationId = registrationIdRef.current ?? nextRegistrationId++;
    registrationIdRef.current = registrationId;
    activeSurfaceThemes.set(registrationId, {
      id: registrationId,
      priority,
      surfaceTheme,
    });
    syncRegisteredSurfaceThemes();

    return () => {
      activeSurfaceThemes.delete(registrationId);
      syncRegisteredSurfaceThemes();
    };
  }, [priority, surfaceTheme]);

  useEffect(() => {
    if (!surfaceTheme || typeof window === 'undefined' || typeof document === 'undefined') return;

    const reapplySurfaceTheme = () => syncRegisteredSurfaceThemes();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reapplySurfaceTheme();
    };

    window.addEventListener('focus', reapplySurfaceTheme);
    window.addEventListener('pageshow', reapplySurfaceTheme);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', reapplySurfaceTheme);
      window.removeEventListener('pageshow', reapplySurfaceTheme);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [surfaceTheme]);
}

export function useThemeColorOverride(color: string | null | undefined, active = true) {
  useIsoLayoutEffect(() => {
    if (!active || !color || typeof document === 'undefined') return;

    const previousThemeColor = getThemeColorMeta()?.getAttribute('content') ?? null;
    setThemeColorMeta(resolveThemeColor(color));

    return () => {
      const meta = getThemeColorMeta();
      if (!meta) return;
      if (previousThemeColor === null) meta.removeAttribute('content');
      else meta.setAttribute('content', previousThemeColor);
    };
  }, [active, color]);
}
