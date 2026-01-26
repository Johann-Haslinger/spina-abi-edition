export type Id = string

export type AssetType = 'exercise' | 'note' | 'cheatsheet' | 'file'

export type Subject = {
  id: Id
  name: string
  color: string
  iconEmoji?: string
}

export type Topic = {
  id: Id
  subjectId: Id
  name: string
  orderIndex: number
  iconEmoji?: string
}

export type Folder = {
  id: Id
  topicId: Id
  parentFolderId?: Id
  name: string
  orderIndex: number
  iconEmoji?: string
}

export type Asset = {
  id: Id
  subjectId: Id
  topicId: Id
  folderId?: Id
  type: AssetType
  title: string
  createdAtMs: number
}

export type AssetFile = {
  assetId: Id
  mimeType: string
  originalName: string
  sizeBytes: number
  blob: Blob
}

export type ExercisePageStatus = 'unknown' | 'partial' | 'captured' | 'covered'

export type StudySession = {
  id: Id
  subjectId: Id
  topicId: Id
  startedAtMs: number
  plannedDurationMs?: number
  endedAtMs?: number
}

export type Exercise = {
  id: Id
  assetId: Id
  status: ExercisePageStatus
}

export type Problem = {
  id: Id
  exerciseId: Id
  idx: number
}

export type Subproblem = {
  id: Id
  problemId: Id
  label: string
}

export type AttemptResult = 'correct' | 'partial' | 'wrong'

export type Attempt = {
  id: Id
  studySessionId: Id
  subproblemId: Id
  startedAtMs: number
  endedAtMs: number
  seconds: number
  result: AttemptResult
  note?: string
  errorType?: string
}

