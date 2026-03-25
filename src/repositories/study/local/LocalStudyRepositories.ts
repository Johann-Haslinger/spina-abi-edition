import { db } from '../../../db/db';
import type {
  Attempt,
  AttemptAiReview,
  AttemptRequirementLink,
  AttemptReviewJob,
  Exercise,
  ExerciseDifficulty,
  Problem,
  StudySession,
  Subproblem,
  Subsubproblem,
} from '../../../domain/models';
import { newId } from '../../../lib/id';
import type {
  AttemptAiReviewRepository,
  AttemptRepository,
  AttemptRequirementLinkRepository,
  AttemptReviewJobRepository,
  ExerciseRepository,
  ProblemRepository,
  StudySessionRepository,
  SubproblemRepository,
  SubsubproblemRepository,
} from '../interfaces';

export class LocalStudySessionRepository implements StudySessionRepository {
  async create(input: {
    subjectId: string;
    topicId: string;
    startedAtMs: number;
    plannedDurationMs?: number;
  }): Promise<StudySession> {
    const row: StudySession = {
      id: newId(),
      subjectId: input.subjectId,
      topicId: input.topicId,
      startedAtMs: input.startedAtMs,
      plannedDurationMs: input.plannedDurationMs,
    };
    await db.studySessions.add(row);
    return row;
  }

  async end(id: string, endedAtMs: number): Promise<void> {
    await db.studySessions.update(id, { endedAtMs });
  }

  async get(id: string): Promise<StudySession | undefined> {
    return db.studySessions.get(id);
  }

  async listByTopic(topicId: string): Promise<StudySession[]> {
    return db.studySessions.where('topicId').equals(topicId).toArray();
  }
}

function normalizeExerciseDifficulty(value: unknown): ExerciseDifficulty {
  return value === 1 || value === 2 || value === 3 ? value : 2;
}

export class LocalExerciseRepository implements ExerciseRepository {
  async getByAsset(assetId: string): Promise<Exercise | undefined> {
    const row = await db.exercises.where('assetId').equals(assetId).first();
    if (!row) return undefined;
    return {
      ...row,
      difficulty: normalizeExerciseDifficulty(row.difficulty),
      taskDepth:
        row.taskDepth === 1 || row.taskDepth === 2 || row.taskDepth === 3 ? row.taskDepth : 2,
    };
  }

  async upsert(input: { assetId: string; status: Exercise['status'] }): Promise<Exercise> {
    const existing = await this.getByAsset(input.assetId);
    if (existing) {
      const next: Exercise = {
        ...existing,
        status: input.status,
        difficulty: normalizeExerciseDifficulty(existing.difficulty),
      };
      await db.exercises.put(next);
      return next;
    }
    const row: Exercise = {
      id: newId(),
      assetId: input.assetId,
      status: input.status,
      taskDepth: 2,
      difficulty: 2,
    };
    await db.exercises.add(row);
    return row;
  }

  async setStatus(id: string, status: Exercise['status']): Promise<void> {
    await db.exercises.update(id, { status });
  }

  async setTaskDepthByAsset(
    assetId: string,
    taskDepth: NonNullable<Exercise['taskDepth']>,
  ): Promise<Exercise> {
    const existing = await this.getByAsset(assetId);
    if (existing) {
      const next: Exercise = {
        ...existing,
        taskDepth,
        difficulty: normalizeExerciseDifficulty(existing.difficulty),
      };
      await db.exercises.put(next);
      return next;
    }
    const row: Exercise = {
      id: newId(),
      assetId,
      status: 'unknown',
      taskDepth,
      difficulty: 2,
    };
    await db.exercises.add(row);
    return row;
  }

  async setDifficultyByAsset(assetId: string, difficulty: ExerciseDifficulty): Promise<Exercise> {
    const existing = await this.getByAsset(assetId);
    if (existing) {
      const next: Exercise = { ...existing, difficulty };
      await db.exercises.put(next);
      return next;
    }
    const row: Exercise = {
      id: newId(),
      assetId,
      status: 'unknown',
      taskDepth: 2,
      difficulty,
    };
    await db.exercises.add(row);
    return row;
  }
}

export class LocalProblemRepository implements ProblemRepository {
  async getOrCreate(input: { exerciseId: string; idx: number }): Promise<Problem> {
    const existing = await db.problems
      .where('[exerciseId+idx]')
      .equals([input.exerciseId, input.idx])
      .first();
    if (existing) return existing;

    const row: Problem = {
      id: newId(),
      exerciseId: input.exerciseId,
      idx: input.idx,
      requirementIds: [],
    };
    await db.problems.add(row);
    return row;
  }

  async listByExercise(exerciseId: string): Promise<Problem[]> {
    return db.problems.where('exerciseId').equals(exerciseId).toArray();
  }
}

export class LocalSubproblemRepository implements SubproblemRepository {
  async getOrCreate(input: { problemId: string; label: string }): Promise<Subproblem> {
    const existing = await db.subproblems
      .where('[problemId+label]')
      .equals([input.problemId, input.label])
      .first();
    if (existing) return existing;

    const row: Subproblem = {
      id: newId(),
      problemId: input.problemId,
      label: input.label.trim(),
      requirementIds: [],
    };
    await db.subproblems.add(row);
    return row;
  }

  async listByProblemIds(problemIds: string[]): Promise<Subproblem[]> {
    if (problemIds.length === 0) return [];
    return db.subproblems.where('problemId').anyOf(problemIds).toArray();
  }
}

export class LocalSubsubproblemRepository implements SubsubproblemRepository {
  async getOrCreate(input: { subproblemId: string; label: string }): Promise<Subsubproblem> {
    const existing = await db.subsubproblems
      .where('[subproblemId+label]')
      .equals([input.subproblemId, input.label])
      .first();
    if (existing) return existing;

    const row: Subsubproblem = {
      id: newId(),
      subproblemId: input.subproblemId,
      label: input.label.trim(),
      requirementIds: [],
    };
    await db.subsubproblems.add(row);
    return row;
  }

  async listBySubproblemIds(subproblemIds: string[]): Promise<Subsubproblem[]> {
    if (subproblemIds.length === 0) return [];
    return db.subsubproblems.where('subproblemId').anyOf(subproblemIds).toArray();
  }
}

export class LocalAttemptRepository implements AttemptRepository {
  async create(input: {
    id?: string;
    studySessionId: string;
    subproblemId: string;
    subsubproblemId?: string;
    startedAtMs: number;
    endedAtMs: number;
    seconds: number;
    result: Attempt['result'];
    note?: string;
    errorType?: string;
    reviewStatus: Attempt['reviewStatus'];
  }): Promise<Attempt> {
    const row: Attempt = {
      id: input.id ?? newId(),
      studySessionId: input.studySessionId,
      subproblemId: input.subproblemId,
      subsubproblemId: input.subsubproblemId,
      startedAtMs: input.startedAtMs,
      endedAtMs: input.endedAtMs,
      seconds: input.seconds,
      result: input.result,
      note: input.note?.trim() || undefined,
      errorType: input.errorType?.trim() || undefined,
      reviewStatus: input.reviewStatus,
    };
    await db.attempts.add(row);
    return row;
  }

  async update(id: string, patch: Partial<Attempt>): Promise<Attempt> {
    const current = await db.attempts.get(id);
    if (!current) throw new Error('Attempt not found');
    const next: Attempt = {
      ...current,
      ...patch,
      ...(patch.note !== undefined ? { note: patch.note?.trim() || undefined } : {}),
      ...(patch.errorType !== undefined ? { errorType: patch.errorType?.trim() || undefined } : {}),
    };
    await db.attempts.put(next);
    return next;
  }

  async get(id: string): Promise<Attempt | undefined> {
    return db.attempts.get(id);
  }

  async listBySubproblem(subproblemId: string): Promise<Attempt[]> {
    return db.attempts.where('subproblemId').equals(subproblemId).toArray();
  }

  async listBySubproblemIds(subproblemIds: string[]): Promise<Attempt[]> {
    if (subproblemIds.length === 0) return [];
    return db.attempts.where('subproblemId').anyOf(subproblemIds).toArray();
  }

  async listByStudySession(studySessionId: string): Promise<Attempt[]> {
    return db.attempts.where('studySessionId').equals(studySessionId).toArray();
  }

  async listByStudySessionIds(studySessionIds: string[]): Promise<Attempt[]> {
    if (studySessionIds.length === 0) return [];
    return db.attempts.where('studySessionId').anyOf(studySessionIds).toArray();
  }

  async listDetailsByStudySession(studySessionId: string): Promise<
    Array<{
      attempt: Attempt;
      assetId: string;
      problemIdx: number;
      subproblemLabel: string;
      subsubproblemLabel?: string;
    }>
  > {
    const attempts = await db.attempts.where('studySessionId').equals(studySessionId).toArray();
    if (attempts.length === 0) return [];

    const subproblemIds = Array.from(new Set(attempts.map((a) => a.subproblemId)));
    const subproblems = await db.subproblems.where('id').anyOf(subproblemIds).toArray();
    if (subproblems.length === 0) return [];

    const subsubproblemIds = Array.from(
      new Set(attempts.map((a) => a.subsubproblemId).filter((x): x is string => Boolean(x))),
    );
    const subsubproblems =
      subsubproblemIds.length > 0
        ? await db.subsubproblems.where('id').anyOf(subsubproblemIds).toArray()
        : [];
    const subsubproblemById = new Map(subsubproblems.map((ssp) => [ssp.id, ssp]));

    const subproblemById = new Map(subproblems.map((sp) => [sp.id, sp]));
    const problemIds = Array.from(new Set(subproblems.map((sp) => sp.problemId)));
    const problems = await db.problems.where('id').anyOf(problemIds).toArray();
    const problemById = new Map(problems.map((p) => [p.id, p]));

    const exerciseIds = Array.from(new Set(problems.map((p) => p.exerciseId)));
    const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray();
    const exerciseById = new Map(exercises.map((e) => [e.id, e]));

    return attempts
      .map((a) => {
        const sp = subproblemById.get(a.subproblemId);
        const ssp = a.subsubproblemId ? subsubproblemById.get(a.subsubproblemId) : undefined;
        const p = sp ? problemById.get(sp.problemId) : undefined;
        const ex = p ? exerciseById.get(p.exerciseId) : undefined;
        return {
          attempt: a,
          assetId: ex?.assetId ?? 'unknown',
          problemIdx: p?.idx ?? 0,
          subproblemLabel: sp?.label ?? '?',
          subsubproblemLabel: ssp?.label,
        };
      })
      .filter((r) => r.assetId !== 'unknown')
      .sort((a, b) => a.attempt.endedAtMs - b.attempt.endedAtMs);
  }

  async listForSessionAsset(input: { studySessionId: string; assetId: string }): Promise<
    Array<{
      attempt: Attempt;
      problemIdx: number;
      subproblemLabel: string;
      subsubproblemLabel?: string;
    }>
  > {
    const exercise = await db.exercises.where('assetId').equals(input.assetId).first();
    if (!exercise) return [];

    const problems = await db.problems.where('exerciseId').equals(exercise.id).toArray();
    if (problems.length === 0) return [];

    const problemIdxById = new Map(problems.map((p) => [p.id, p.idx]));
    const subproblems = await db.subproblems
      .where('problemId')
      .anyOf(problems.map((p) => p.id))
      .toArray();
    if (subproblems.length === 0) return [];

    const subproblemMetaById = new Map(
      subproblems.map((sp) => [
        sp.id,
        { problemIdx: problemIdxById.get(sp.problemId) ?? 0, subproblemLabel: sp.label },
      ]),
    );
    const subproblemIds = new Set(subproblems.map((sp) => sp.id));

    const attempts = await db.attempts
      .where('studySessionId')
      .equals(input.studySessionId)
      .toArray();

    const subsubproblemIds = Array.from(
      new Set(attempts.map((a) => a.subsubproblemId).filter((x): x is string => Boolean(x))),
    );
    const subsubproblems =
      subsubproblemIds.length > 0
        ? await db.subsubproblems.where('id').anyOf(subsubproblemIds).toArray()
        : [];
    const subsubproblemLabelById = new Map(subsubproblems.map((ssp) => [ssp.id, ssp.label]));

    return attempts
      .filter((a) => subproblemIds.has(a.subproblemId))
      .map((a) => {
        const meta = subproblemMetaById.get(a.subproblemId);
        return {
          attempt: a,
          problemIdx: meta?.problemIdx ?? 0,
          subproblemLabel: meta?.subproblemLabel ?? '?',
          subsubproblemLabel: a.subsubproblemId
            ? subsubproblemLabelById.get(a.subsubproblemId)
            : undefined,
        };
      })
      .sort((a, b) => a.attempt.endedAtMs - b.attempt.endedAtMs);
  }
}

export class LocalAttemptReviewJobRepository implements AttemptReviewJobRepository {
  async create(input: Omit<AttemptReviewJob, 'id'> & { id?: string }): Promise<AttemptReviewJob> {
    const row: AttemptReviewJob = {
      ...input,
      id: input.id ?? newId(),
    };
    await db.attemptReviewJobs.put(row);
    return row;
  }

  async update(id: string, patch: Partial<AttemptReviewJob>): Promise<AttemptReviewJob> {
    const current = await db.attemptReviewJobs.get(id);
    if (!current) throw new Error('Attempt review job not found');
    const next: AttemptReviewJob = { ...current, ...patch };
    await db.attemptReviewJobs.put(next);
    return next;
  }

  async getByAttempt(attemptId: string): Promise<AttemptReviewJob | undefined> {
    return db.attemptReviewJobs.where('attemptId').equals(attemptId).first();
  }
}

export class LocalAttemptAiReviewRepository implements AttemptAiReviewRepository {
  async upsert(input: Omit<AttemptAiReview, 'id'> & { id?: string }): Promise<AttemptAiReview> {
    const existing = await db.attemptAiReviews.where('attemptId').equals(input.attemptId).first();
    const row: AttemptAiReview = {
      ...(existing ?? { id: input.id ?? newId() }),
      ...input,
      id: existing?.id ?? input.id ?? newId(),
    };
    await db.attemptAiReviews.put(row);
    return row;
  }

  async getByAttempt(attemptId: string): Promise<AttemptAiReview | undefined> {
    return db.attemptAiReviews.where('attemptId').equals(attemptId).first();
  }
}

export class LocalAttemptRequirementLinkRepository implements AttemptRequirementLinkRepository {
  async replaceForAttempt(
    attemptId: string,
    links: Omit<AttemptRequirementLink, 'id' | 'attemptId'>[],
  ): Promise<void> {
    await db.transaction('rw', db.attemptRequirementLinks, async () => {
      const existing = await db.attemptRequirementLinks
        .where('attemptId')
        .equals(attemptId)
        .toArray();
      if (existing.length)
        await db.attemptRequirementLinks.bulkDelete(existing.map((row) => row.id));
      if (!links.length) return;
      const rows: AttemptRequirementLink[] = links.map((link) => ({
        id: newId(),
        attemptId,
        requirementId: link.requirementId,
        confidence: link.confidence,
        masteryDelta: link.masteryDelta,
      }));
      await db.attemptRequirementLinks.bulkAdd(rows);
    });
  }

  async listByAttemptIds(attemptIds: string[]): Promise<AttemptRequirementLink[]> {
    if (attemptIds.length === 0) return [];
    return db.attemptRequirementLinks.where('attemptId').anyOf(attemptIds).toArray();
  }
}
