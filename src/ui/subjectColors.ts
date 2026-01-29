import { SubjectColorId, type SubjectColorAssignment } from '../domain/models';

export type ThemeMode = 'light' | 'dark';

export type SubjectColorHex = string;

export type SubjectColorOption = {
  id: SubjectColorId;
  name: string;
};

export const subjectColorOptions: SubjectColorOption[] = [
  { id: SubjectColorId.Green, name: 'Grün' },
  { id: SubjectColorId.LightBlue, name: 'Hellblau' },
  { id: SubjectColorId.Orange, name: 'Orange' },
  { id: SubjectColorId.Red, name: 'Rot' },
  { id: SubjectColorId.DarkBlue, name: 'Dunkelblau' },
];

export const SUBJECT_COLORS: Record<ThemeMode, Record<SubjectColorId, SubjectColorHex>> = {
  light: {
    [SubjectColorId.Green]: '#16A34A',
    [SubjectColorId.LightBlue]: '#2563EB',
    [SubjectColorId.Orange]: '#E98226',
    [SubjectColorId.Red]: '#E12F25',
    [SubjectColorId.DarkBlue]: '#1C65CB',
  },
  dark: {
    [SubjectColorId.Green]: '#22C55E',
    [SubjectColorId.LightBlue]: '#3B82F6',
    [SubjectColorId.Orange]: '#F97316',
    [SubjectColorId.Red]: '#FB7185',
    [SubjectColorId.DarkBlue]: '#60A5FA',
  },
};

export const DEFAULT_SUBJECT_COLOR: SubjectColorAssignment = {
  colorId: SubjectColorId.DarkBlue,
};
