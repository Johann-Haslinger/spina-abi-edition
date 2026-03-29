import { useMemo } from 'react';
import type { Subject } from '../../domain/models';
import { useSubjectsStore } from '../../stores/subjectsStore';
import { useThemeStore } from '../../stores/themeStore';
import { resolveSubjectHex } from '../subjectColorResolvers';
import { DEFAULT_SUBJECT_COLOR } from '../subjectColors';
import {
  resolveNeutralSurfaceTheme,
  resolveSubjectSurfaceTheme,
} from '../subjectThemeSurfaces';

export function useSubjectFromParam(subjectOrId?: Subject | string): Subject | undefined {
  const subjects = useSubjectsStore((s) => s.subjects);
  if (!subjectOrId) return undefined;
  if (typeof subjectOrId === 'string') return subjects.find((s) => s.id === subjectOrId);
  return subjectOrId;
}

export function useSubjectAccentColor(subjectOrId?: Subject | string) {
  const theme = useThemeStore((s) => s.effectiveTheme);
  const subject = useSubjectFromParam(subjectOrId);
  const assignment = subject?.color ?? DEFAULT_SUBJECT_COLOR;

  return useMemo(() => resolveSubjectHex(assignment, theme), [assignment, theme]);
}

export function usePageSurfaceTheme(subjectOrId?: Subject | string | null) {
  const theme = useThemeStore((s) => s.effectiveTheme);
  const subject = useSubjectFromParam(subjectOrId ?? undefined);

  return useMemo(() => {
    if (!subject) return resolveNeutralSurfaceTheme(theme);
    return resolveSubjectSurfaceTheme(subject.color, theme);
  }, [subject, theme]);
}

export function useNeutralSurfaceTheme() {
  const theme = useThemeStore((s) => s.effectiveTheme);

  return useMemo(() => resolveNeutralSurfaceTheme(theme), [theme]);
}
