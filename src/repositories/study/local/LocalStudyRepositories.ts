import { db } from '../../../db/db'
import type { Exercise, Problem, StudySession, Subproblem, Attempt } from '../../../domain/models'
import { newId } from '../../../lib/id'
import type {
  AttemptRepository,
  ExerciseRepository,
  ProblemRepository,
  StudySessionRepository,
  SubproblemRepository,
} from '../interfaces'

export class LocalStudySessionRepository implements StudySessionRepository {
  async create(input: {
    subjectId: string
    topicId: string
    startedAtMs: number
    plannedDurationMs?: number
  }): Promise<StudySession> {
    const row: StudySession = {
      id: newId(),
      subjectId: input.subjectId,
      topicId: input.topicId,
      startedAtMs: input.startedAtMs,
      plannedDurationMs: input.plannedDurationMs,
    }
    await db.studySessions.add(row)
    return row
  }

  async end(id: string, endedAtMs: number): Promise<void> {
    await db.studySessions.update(id, { endedAtMs })
  }

  async get(id: string): Promise<StudySession | undefined> {
    return db.studySessions.get(id)
  }
}

export class LocalExerciseRepository implements ExerciseRepository {
  async getByAsset(assetId: string): Promise<Exercise | undefined> {
    return db.exercises.where('assetId').equals(assetId).first()
  }

  async upsert(input: { assetId: string; status: Exercise['status'] }): Promise<Exercise> {
    const existing = await this.getByAsset(input.assetId)
    if (existing) {
      const next: Exercise = { ...existing, status: input.status }
      await db.exercises.put(next)
      return next
    }
    const row: Exercise = { id: newId(), assetId: input.assetId, status: input.status }
    await db.exercises.add(row)
    return row
  }

  async setStatus(id: string, status: Exercise['status']): Promise<void> {
    await db.exercises.update(id, { status })
  }
}

export class LocalProblemRepository implements ProblemRepository {
  async getOrCreate(input: { exerciseId: string; idx: number }): Promise<Problem> {
    const existing = await db.problems
      .where('[exerciseId+idx]')
      .equals([input.exerciseId, input.idx])
      .first()
    if (existing) return existing

    const row: Problem = { id: newId(), exerciseId: input.exerciseId, idx: input.idx }
    await db.problems.add(row)
    return row
  }

  async listByExercise(exerciseId: string): Promise<Problem[]> {
    return db.problems.where('exerciseId').equals(exerciseId).toArray()
  }
}

export class LocalSubproblemRepository implements SubproblemRepository {
  async getOrCreate(input: { problemId: string; label: string }): Promise<Subproblem> {
    const existing = await db.subproblems
      .where('[problemId+label]')
      .equals([input.problemId, input.label])
      .first()
    if (existing) return existing

    const row: Subproblem = {
      id: newId(),
      problemId: input.problemId,
      label: input.label.trim(),
    }
    await db.subproblems.add(row)
    return row
  }

  async listByProblemIds(problemIds: string[]): Promise<Subproblem[]> {
    if (problemIds.length === 0) return []
    return db.subproblems.where('problemId').anyOf(problemIds).toArray()
  }
}

export class LocalAttemptRepository implements AttemptRepository {
  async create(input: {
    studySessionId: string
    subproblemId: string
    startedAtMs: number
    endedAtMs: number
    seconds: number
    result: Attempt['result']
    note?: string
    errorType?: string
  }): Promise<Attempt> {
    const row: Attempt = {
      id: newId(),
      studySessionId: input.studySessionId,
      subproblemId: input.subproblemId,
      startedAtMs: input.startedAtMs,
      endedAtMs: input.endedAtMs,
      seconds: input.seconds,
      result: input.result,
      note: input.note?.trim() || undefined,
      errorType: input.errorType?.trim() || undefined,
    }
    await db.attempts.add(row)
    return row
  }

  async listBySubproblem(subproblemId: string): Promise<Attempt[]> {
    return db.attempts.where('subproblemId').equals(subproblemId).toArray()
  }

  async listBySubproblemIds(subproblemIds: string[]): Promise<Attempt[]> {
    if (subproblemIds.length === 0) return []
    return db.attempts.where('subproblemId').anyOf(subproblemIds).toArray()
  }

  async listByStudySession(studySessionId: string): Promise<Attempt[]> {
    return db.attempts.where('studySessionId').equals(studySessionId).toArray()
  }

  async listDetailsByStudySession(studySessionId: string): Promise<
    Array<{
      attempt: Attempt
      assetId: string
      problemIdx: number
      subproblemLabel: string
    }>
  > {
    const attempts = await db.attempts.where('studySessionId').equals(studySessionId).toArray()
    if (attempts.length === 0) return []

    const subproblemIds = Array.from(new Set(attempts.map((a) => a.subproblemId)))
    const subproblems = await db.subproblems.where('id').anyOf(subproblemIds).toArray()
    if (subproblems.length === 0) return []

    const subproblemById = new Map(subproblems.map((sp) => [sp.id, sp]))
    const problemIds = Array.from(new Set(subproblems.map((sp) => sp.problemId)))
    const problems = await db.problems.where('id').anyOf(problemIds).toArray()
    const problemById = new Map(problems.map((p) => [p.id, p]))

    const exerciseIds = Array.from(new Set(problems.map((p) => p.exerciseId)))
    const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray()
    const exerciseById = new Map(exercises.map((e) => [e.id, e]))

    return attempts
      .map((a) => {
        const sp = subproblemById.get(a.subproblemId)
        const p = sp ? problemById.get(sp.problemId) : undefined
        const ex = p ? exerciseById.get(p.exerciseId) : undefined
        return {
          attempt: a,
          assetId: ex?.assetId ?? 'unknown',
          problemIdx: p?.idx ?? 0,
          subproblemLabel: sp?.label ?? '?',
        }
      })
      .filter((r) => r.assetId !== 'unknown')
      .sort((a, b) => a.attempt.endedAtMs - b.attempt.endedAtMs)
  }

  async listForSessionAsset(input: {
    studySessionId: string
    assetId: string
  }): Promise<Array<{ attempt: Attempt; problemIdx: number; subproblemLabel: string }>> {
    const exercise = await db.exercises.where('assetId').equals(input.assetId).first()
    if (!exercise) return []

    const problems = await db.problems.where('exerciseId').equals(exercise.id).toArray()
    if (problems.length === 0) return []

    const problemIdxById = new Map(problems.map((p) => [p.id, p.idx]))
    const subproblems = await db.subproblems.where('problemId').anyOf(problems.map((p) => p.id)).toArray()
    if (subproblems.length === 0) return []

    const subproblemMetaById = new Map(
      subproblems.map((sp) => [
        sp.id,
        { problemIdx: problemIdxById.get(sp.problemId) ?? 0, subproblemLabel: sp.label },
      ]),
    )
    const subproblemIds = new Set(subproblems.map((sp) => sp.id))

    const attempts = await db.attempts
      .where('studySessionId')
      .equals(input.studySessionId)
      .toArray()

    return attempts
      .filter((a) => subproblemIds.has(a.subproblemId))
      .map((a) => {
        const meta = subproblemMetaById.get(a.subproblemId)
        return {
          attempt: a,
          problemIdx: meta?.problemIdx ?? 0,
          subproblemLabel: meta?.subproblemLabel ?? '?',
        }
      })
      .sort((a, b) => a.attempt.endedAtMs - b.attempt.endedAtMs)
  }
}

