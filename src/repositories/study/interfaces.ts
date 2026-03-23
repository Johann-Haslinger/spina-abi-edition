import type {
  Attempt,
  AttemptAiReview,
  AttemptRequirementLink,
  AttemptResult,
  AttemptReviewJob,
  AttemptReviewStatus,
  Exercise,
  ExercisePageStatus,
  ExerciseTaskDepth,
  Problem,
  StudySession,
  Subproblem,
  Subsubproblem,
} from '../../domain/models';

export interface StudySessionRepository {
  create(input: {
    subjectId: string;
    topicId: string;
    startedAtMs: number;
    plannedDurationMs?: number;
  }): Promise<StudySession>;
  end(id: string, endedAtMs: number): Promise<void>;
  get(id: string): Promise<StudySession | undefined>;
}

export interface ExerciseRepository {
  getByAsset(assetId: string): Promise<Exercise | undefined>;
  upsert(input: { assetId: string; status: ExercisePageStatus }): Promise<Exercise>;
  setStatus(id: string, status: ExercisePageStatus): Promise<void>;
  setTaskDepthByAsset(assetId: string, taskDepth: ExerciseTaskDepth): Promise<Exercise>;
}

export interface ProblemRepository {
  getOrCreate(input: { exerciseId: string; idx: number }): Promise<Problem>;
  listByExercise(exerciseId: string): Promise<Problem[]>;
}

export interface SubproblemRepository {
  getOrCreate(input: { problemId: string; label: string }): Promise<Subproblem>;
  listByProblemIds(problemIds: string[]): Promise<Subproblem[]>;
}

export interface SubsubproblemRepository {
  getOrCreate(input: { subproblemId: string; label: string }): Promise<Subsubproblem>;
  listBySubproblemIds(subproblemIds: string[]): Promise<Subsubproblem[]>;
}

export interface AttemptRepository {
  create(input: {
    id?: string;
    studySessionId: string;
    subproblemId: string;
    subsubproblemId?: string;
    startedAtMs: number;
    endedAtMs: number;
    seconds: number;
    result: AttemptResult;
    note?: string;
    errorType?: string;
    reviewStatus: AttemptReviewStatus;
  }): Promise<Attempt>;
  update(id: string, patch: Partial<Attempt>): Promise<Attempt>;
  get(id: string): Promise<Attempt | undefined>;
  listBySubproblem(subproblemId: string): Promise<Attempt[]>;
  listBySubproblemIds(subproblemIds: string[]): Promise<Attempt[]>;
  listByStudySession(studySessionId: string): Promise<Attempt[]>;
  listDetailsByStudySession(studySessionId: string): Promise<
    Array<{
      attempt: Attempt;
      assetId: string;
      problemIdx: number;
      subproblemLabel: string;
      subsubproblemLabel?: string;
    }>
  >;
  listForSessionAsset(input: { studySessionId: string; assetId: string }): Promise<
    Array<{
      attempt: Attempt;
      problemIdx: number;
      subproblemLabel: string;
      subsubproblemLabel?: string;
    }>
  >;
}

export interface AttemptReviewJobRepository {
  create(input: Omit<AttemptReviewJob, 'id'> & { id?: string }): Promise<AttemptReviewJob>;
  update(id: string, patch: Partial<AttemptReviewJob>): Promise<AttemptReviewJob>;
  getByAttempt(attemptId: string): Promise<AttemptReviewJob | undefined>;
}

export interface AttemptAiReviewRepository {
  upsert(input: Omit<AttemptAiReview, 'id'> & { id?: string }): Promise<AttemptAiReview>;
  getByAttempt(attemptId: string): Promise<AttemptAiReview | undefined>;
}

export interface AttemptRequirementLinkRepository {
  replaceForAttempt(
    attemptId: string,
    links: Omit<AttemptRequirementLink, 'id' | 'attemptId'>[],
  ): Promise<void>;
  listByAttemptIds(attemptIds: string[]): Promise<AttemptRequirementLink[]>;
}
