import { useEffect, useLayoutEffect } from 'react';
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

function getThemeColorMeta() {
  return document.querySelector('meta[name="theme-color"]');
}

function setThemeColorMeta(color: string) {
  getThemeColorMeta()?.setAttribute('content', color);
}

function resolveThemeColor(color: string) {
  const cssVarMatch = color.match(/^var\((--[^)]+)\)$/);
  if (!cssVarMatch) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(cssVarMatch[1]).trim() || color;
}

function applySurfaceTheme(surfaceTheme: AppSurfaceTheme) {
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

export function useAppSurfaceTheme(surfaceTheme: AppSurfaceTheme | null | undefined) {
  useIsoLayoutEffect(() => {
    if (!surfaceTheme || typeof document === 'undefined') return;

    const root = document.documentElement;
    const previousVarValues = new Map(
      SURFACE_VAR_NAMES.map((name) => [name, root.style.getPropertyValue(name)]),
    );
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousThemeColor = getThemeColorMeta()?.getAttribute('content') ?? null;

    applySurfaceTheme(surfaceTheme);

    return () => {
      for (const [name, value] of previousVarValues) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
      document.body.style.backgroundColor = previousBodyBackground;
      const meta = getThemeColorMeta();
      if (!meta) return;
      if (previousThemeColor === null) meta.removeAttribute('content');
      else meta.setAttribute('content', previousThemeColor);
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
