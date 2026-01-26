import type {
  Attempt,
  AttemptResult,
  Exercise,
  ExercisePageStatus,
  Problem,
  StudySession,
  Subproblem,
} from '../../domain/models'

export interface StudySessionRepository {
  create(input: {
    subjectId: string
    topicId: string
    startedAtMs: number
    plannedDurationMs?: number
  }): Promise<StudySession>
  end(id: string, endedAtMs: number): Promise<void>
  get(id: string): Promise<StudySession | undefined>
}

export interface ExerciseRepository {
  getByAsset(assetId: string): Promise<Exercise | undefined>
  upsert(input: { assetId: string; status: ExercisePageStatus }): Promise<Exercise>
  setStatus(id: string, status: ExercisePageStatus): Promise<void>
}

export interface ProblemRepository {
  getOrCreate(input: { exerciseId: string; idx: number }): Promise<Problem>
  listByExercise(exerciseId: string): Promise<Problem[]>
}

export interface SubproblemRepository {
  getOrCreate(input: { problemId: string; label: string }): Promise<Subproblem>
  listByProblemIds(problemIds: string[]): Promise<Subproblem[]>
}

export interface AttemptRepository {
  create(input: {
    studySessionId: string
    subproblemId: string
    startedAtMs: number
    endedAtMs: number
    seconds: number
    result: AttemptResult
    note?: string
    errorType?: string
  }): Promise<Attempt>
  listBySubproblem(subproblemId: string): Promise<Attempt[]>
  listBySubproblemIds(subproblemIds: string[]): Promise<Attempt[]>
  listByStudySession(studySessionId: string): Promise<Attempt[]>
  listDetailsByStudySession(studySessionId: string): Promise<
    Array<{
      attempt: Attempt
      assetId: string
      problemIdx: number
      subproblemLabel: string
    }>
  >
  listForSessionAsset(input: {
    studySessionId: string
    assetId: string
  }): Promise<Array<{ attempt: Attempt; problemIdx: number; subproblemLabel: string }>>
}

