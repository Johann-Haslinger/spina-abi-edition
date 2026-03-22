export type Id = string;

export type AssetType = 'exercise' | 'note' | 'cheatsheet' | 'file';

export const SubjectColorId = {
  Green: 'green',
  LightBlue: 'lightBlue',
  Orange: 'orange',
  Red: 'red',
  DarkBlue: 'darkBlue',
} as const;

export type SubjectColorId = (typeof SubjectColorId)[keyof typeof SubjectColorId];

export type SubjectColorAssignment = {
  colorId: SubjectColorId;
};

export type Subject = {
  id: Id;
  name: string;
  color: SubjectColorAssignment;
  iconEmoji?: string;
};

export type Topic = {
  id: Id;
  subjectId: Id;
  name: string;
  iconEmoji?: string;
};

export type Folder = {
  id: Id;
  topicId: Id;
  parentFolderId?: Id;
  name: string;
  orderIndex: number;
  iconEmoji?: string;
};

export type Asset = {
  id: Id;
  subjectId: Id;
  topicId: Id;
  folderId?: Id;
  type: AssetType;
  title: string;
  createdAtMs: number;
};

export type AssetFile = {
  assetId: Id;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  blob: Blob;
};

export type ExercisePageStatus = 'unknown' | 'partial' | 'captured' | 'covered';

export type StudySession = {
  id: Id;
  subjectId: Id;
  topicId: Id;
  startedAtMs: number;
  plannedDurationMs?: number;
  endedAtMs?: number;
};

export type PlannedItemType = 'studySession' | 'event';

export type WeeklyRecurrence = {
  kind: 'weekly';
  intervalWeeks: number;
  untilAtMs?: number;
  occurrenceCount?: number;
};

export type PlannedItem = {
  id: Id;
  type: PlannedItemType;

  // For planned study sessions (type === 'studySession')
  subjectId?: Id;
  topicId?: Id;

  // For generic events (type === 'event')
  title?: string;

  startAtMs: number;
  durationMs: number;

  // When unset/undefined => no recurrence.
  recurrence?: WeeklyRecurrence;

  createdAtMs: number;
  updatedAtMs: number;
};

export type Exercise = {
  id: Id;
  assetId: Id;
  status: ExercisePageStatus;
  taskDepth: ExerciseTaskDepth;
};

export type ExerciseTaskDepth = 1 | 2 | 3;

export type Problem = {
  id: Id;
  exerciseId: Id;
  idx: number;
};

export type Subproblem = {
  id: Id;
  problemId: Id;
  label: string;
};

export type Subsubproblem = {
  id: Id;
  subproblemId: Id;
  label: string;
};

export type AttemptResult = 'correct' | 'partial' | 'wrong';

export type Attempt = {
  id: Id;
  studySessionId: Id;
  subproblemId: Id;
  subsubproblemId?: Id;
  startedAtMs: number;
  endedAtMs: number;
  seconds: number;
  result: AttemptResult;
  note?: string;
  errorType?: string;
};

export type InkTool = 'pencil' | 'pen' | 'marker';

export type InkBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type InkPoint = [number, number, number, number];

export type InkStroke = {
  id: Id;
  studySessionId: Id;
  assetId: Id;
  attemptId: Id;
  createdAtMs: number;
  updatedAtMs: number;
  tool: InkTool;
  color: string;
  opacity: number;
  baseSize: number;
  points: InkPoint[];
  bbox: InkBBox;
};
