import type { SubjectColorAssignment } from '../domain/models';
import type { EffectiveTheme } from '../stores/themeStore';
import { resolveSubjectHex } from './subjectColorResolvers';

export type AppSurfaceTheme = {
  accent: string;
  pageBackground: string;
  floatingBackground: string;
  floatingSolidBackground: string;
  modalBackground: string;
  modalThemeColor: string;
  overlayBackground: string;
  themeColor: string;
};

const NEUTRAL_PAGE_BACKGROUNDS: Record<EffectiveTheme, string> = {
  light: '#151515',
  dark: '#151515',
};

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => part + part)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Unsupported hex color: ${hex}`);
  }

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clampByte(value).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(baseHex: string, tintHex: string, tintAmount: number) {
  const base = hexToRgb(baseHex);
  const tint = hexToRgb(tintHex);

  return rgbToHex({
    r: base.r + (tint.r - base.r) * tintAmount,
    g: base.g + (tint.g - base.g) * tintAmount,
    b: base.b + (tint.b - base.b) * tintAmount,
  });
}

function rgba(hex: string, alpha: number) {
  const color = hexToRgb(hex);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function buildSurfaceTheme(accent: string, effectiveTheme: EffectiveTheme): AppSurfaceTheme {
  const neutralPageBackground = NEUTRAL_PAGE_BACKGROUNDS[effectiveTheme];
  const pageBackground = mixHex('#151515', accent, 0.1);
  const floatingSolidBackground = mixHex(
    pageBackground,
    effectiveTheme === 'dark' ? '#FFFFFF' : accent,
    effectiveTheme === 'dark' ? 0.08 : 0.12,
  );
  const modalSolidBackground = mixHex(floatingSolidBackground, '#111827', 0.24);
  const themeColor =
    effectiveTheme === 'dark'
      ? mixHex(pageBackground, '#111827', 0.18)
      : mixHex(pageBackground, accent, 0.12);

  return {
    accent,
    pageBackground,
    floatingBackground: rgba(floatingSolidBackground, effectiveTheme === 'dark' ? 0.76 : 0.74),
    floatingSolidBackground,
    modalBackground: rgba(modalSolidBackground, 0.92),
    modalThemeColor: mixHex(modalSolidBackground, '#000000', 0.1),
    overlayBackground: rgba(
      mixHex(themeColor, effectiveTheme === 'dark' ? '#020617' : '#111827', 0.58),
      effectiveTheme === 'dark' ? 0.8 : 0.72,
    ),
    themeColor: mixHex(neutralPageBackground, themeColor, 0.88),
  };
}

export function resolveSubjectSurfaceTheme(
  assignment: SubjectColorAssignment,
  effectiveTheme: EffectiveTheme,
) {
  return buildSurfaceTheme(resolveSubjectHex(assignment, effectiveTheme), effectiveTheme);
}

export function resolveNeutralSurfaceTheme(effectiveTheme: EffectiveTheme): AppSurfaceTheme {
  const accent = effectiveTheme === 'dark' ? '#94A3B8' : '#64748B';
  return {
    ...buildSurfaceTheme(accent, effectiveTheme),
    pageBackground: NEUTRAL_PAGE_BACKGROUNDS[effectiveTheme],
    themeColor: NEUTRAL_PAGE_BACKGROUNDS[effectiveTheme],
  };
}
