import type { Subject } from '../domain/models';

export const SUBJECT_THEME_CACHE_KEY = 'spina:subject-theme-cache:v1';

export function readCachedSubject(subjectId: string): Subject | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(SUBJECT_THEME_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, Subject>;
    return parsed[subjectId];
  } catch {
    return undefined;
  }
}

export function writeCachedSubject(subject: Subject | undefined) {
  if (!subject || typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SUBJECT_THEME_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Subject>) : {};
    parsed[subject.id] = subject;
    window.localStorage.setItem(SUBJECT_THEME_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore cache write failures and fall back to async repository reads.
  }
}
