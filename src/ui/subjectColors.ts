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
  { id: SubjectColorId.Yellow, name: 'Gelb' },
  { id: SubjectColorId.DarkViolet, name: 'Dunkelviolett' },
  { id: SubjectColorId.LightViolet, name: 'Hellviolett' },
  { id: SubjectColorId.Pink, name: 'Pink' },
];

export const SUBJECT_COLORS: Record<ThemeMode, Record<SubjectColorId, SubjectColorHex>> = {
  light: {
    [SubjectColorId.Green]: '#16A34A',
    [SubjectColorId.LightBlue]: '#2563EB',
    [SubjectColorId.Orange]: '#E98226',
    [SubjectColorId.Red]: '#FF3B30',
    [SubjectColorId.DarkBlue]: '#1C65CB',
    [SubjectColorId.DarkViolet]: '#5856D6',
    [SubjectColorId.LightViolet]: '#AF52DE',
    [SubjectColorId.Pink]: '#FF2D55',
    [SubjectColorId.Yellow]: '#FFD600',
  },
  dark: {
    [SubjectColorId.Red]: '#FF3B30',
    [SubjectColorId.Orange]: '#FF9500',
    [SubjectColorId.Yellow]: '#FFD600',
    [SubjectColorId.Green]: '#34C759',
    [SubjectColorId.LightBlue]: '#5AC8FA',
    [SubjectColorId.DarkBlue]: '#007AFF',
    [SubjectColorId.DarkViolet]: '#5856D6',
    [SubjectColorId.LightViolet]: '#AF52DE',
    [SubjectColorId.Pink]: '#FF2D55',
  },
};

export const DEFAULT_SUBJECT_COLOR: SubjectColorAssignment = {
  colorId: SubjectColorId.DarkBlue,
};
