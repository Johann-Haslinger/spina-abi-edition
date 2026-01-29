import type { SubjectColorAssignment } from '../domain/models';
import { SUBJECT_COLORS, type ThemeMode } from './subjectColors';

export function resolveSubjectHex(assignment: SubjectColorAssignment, theme: ThemeMode): string {
  return SUBJECT_COLORS[theme][assignment.colorId];
}
