export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function hexToRgba(hex: string | undefined, alpha: number): string | undefined {
  if (!hex) return undefined;
  const raw = hex.trim().replace('#', '');
  if (raw.length !== 6) return undefined;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return undefined;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const INITIAL_TOP_MARGIN = 80;

export function formatExerciseStatus(status: 'unknown' | 'partial' | 'captured' | 'covered') {
  switch (status) {
    case 'unknown':
      return 'Unbekannt';
    case 'partial':
      return 'Teilweise';
    case 'captured':
      return 'Erfasst';
    case 'covered':
      return 'Abgedeckt';
    default:
      return status;
  }
}
