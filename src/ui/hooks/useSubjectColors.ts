import { useEffect, useMemo, useState } from 'react';
import type { Subject } from '../../domain/models';
import { subjectRepo } from '../../repositories';
import { useSubjectsStore } from '../../stores/subjectsStore';
import { useThemeStore } from '../../stores/themeStore';
import { resolveSubjectHex } from '../subjectColorResolvers';
import { DEFAULT_SUBJECT_COLOR } from '../subjectColors';
import { readCachedSubject, writeCachedSubject } from '../subjectThemeCache';
import { resolveNeutralSurfaceTheme, resolveSubjectSurfaceTheme } from '../subjectThemeSurfaces';

export function useSubjectFromParam(subjectOrId?: Subject | string): Subject | undefined {
  const subjects = useSubjectsStore((s) => s.subjects);
  const loading = useSubjectsStore((s) => s.loading);
  const refresh = useSubjectsStore((s) => s.refresh);
  const [fetchedSubject, setFetchedSubject] = useState<Subject | undefined>(undefined);
  const cachedSubject = useMemo(
    () => (typeof subjectOrId === 'string' ? readCachedSubject(subjectOrId) : undefined),
    [subjectOrId],
  );

  useEffect(() => {
    if (typeof subjectOrId !== 'string') return;
    if (subjects.length > 0 || loading) return;
    void refresh();
  }, [loading, refresh, subjectOrId, subjects.length]);

  useEffect(() => {
    if (typeof subjectOrId !== 'string') {
      setFetchedSubject(undefined);
      return;
    }
    if (subjects.some((s) => s.id === subjectOrId)) {
      setFetchedSubject(undefined);
      return;
    }

    let cancelled = false;
    void subjectRepo.get(subjectOrId).then((row) => {
      if (cancelled) return;
      const inStore = useSubjectsStore.getState().subjects.some((s) => s.id === subjectOrId);
      if (inStore) return;
      setFetchedSubject(row);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectOrId, subjects]);

  useEffect(() => {
    if (!subjectOrId) return;
    if (typeof subjectOrId !== 'string') {
      writeCachedSubject(subjectOrId);
      return;
    }
    const subject = subjects.find((s) => s.id === subjectOrId) ?? fetchedSubject ?? cachedSubject;
    writeCachedSubject(subject);
  }, [cachedSubject, fetchedSubject, subjectOrId, subjects]);

  if (!subjectOrId) return undefined;
  if (typeof subjectOrId === 'string') {
    return subjects.find((s) => s.id === subjectOrId) ?? fetchedSubject ?? cachedSubject;
  }
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
