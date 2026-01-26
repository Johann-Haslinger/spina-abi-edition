import { create } from 'zustand'
import type { AttemptResult, ExercisePageStatus } from '../../../domain/models'
import {
  attemptRepo,
  exerciseRepo,
  problemRepo,
  studySessionRepo,
  subproblemRepo,
} from '../../../repositories'

type StudyState = {
  studySessionId: string | null
  attemptStartedAtMs: number | null
  problemIdx: number
  subproblemLabel: string
  exerciseStatusByAssetId: Record<string, ExercisePageStatus>

  ensureStudySession: (input: {
    subjectId: string
    topicId: string
    startedAtMs: number
    plannedDurationMs?: number
  }) => Promise<string>

  setProblemIdx: (idx: number) => void
  setSubproblemLabel: (label: string) => void

  startAttempt: () => void
  cancelAttempt: () => void

  loadExerciseStatus: (assetId: string) => Promise<void>
  setExerciseStatus: (assetId: string, status: ExercisePageStatus) => Promise<void>

  logAttempt: (input: {
    assetId: string
    problemIdx: number
    subproblemLabel: string
    endedAtMs: number
    result: AttemptResult
    note?: string
    errorType?: string
  }) => Promise<void>

  reset: () => void
}

export const useStudyStore = create<StudyState>((set, get) => ({
  studySessionId: null,
  attemptStartedAtMs: null,
  problemIdx: 1,
  subproblemLabel: 'a',
  exerciseStatusByAssetId: {},

  ensureStudySession: async ({ subjectId, topicId, startedAtMs, plannedDurationMs }) => {
    const existing = get().studySessionId
    if (existing) return existing
    const created = await studySessionRepo.create({
      subjectId,
      topicId,
      startedAtMs,
      plannedDurationMs,
    })
    set({ studySessionId: created.id })
    return created.id
  },

  setProblemIdx: (idx) => set({ problemIdx: idx }),
  setSubproblemLabel: (label) => set({ subproblemLabel: label }),

  startAttempt: () => {
    if (get().attemptStartedAtMs) return
    set({ attemptStartedAtMs: Date.now() })
  },

  cancelAttempt: () => set({ attemptStartedAtMs: null }),

  loadExerciseStatus: async (assetId) => {
    const ex = await exerciseRepo.getByAsset(assetId)
    set((s) => ({
      exerciseStatusByAssetId: { ...s.exerciseStatusByAssetId, [assetId]: ex?.status ?? 'unknown' },
    }))
  },

  setExerciseStatus: async (assetId, status) => {
    const ex = await exerciseRepo.upsert({ assetId, status })
    set((s) => ({
      exerciseStatusByAssetId: { ...s.exerciseStatusByAssetId, [assetId]: ex.status },
    }))
  },

  logAttempt: async (input) => {
    const { studySessionId, attemptStartedAtMs } = get()
    if (!studySessionId) throw new Error('No studySessionId')
    if (!attemptStartedAtMs) throw new Error('No running attempt')

    const startedAtMs = attemptStartedAtMs
    const endedAtMs = input.endedAtMs
    const seconds = Math.max(1, Math.round((endedAtMs - startedAtMs) / 1000))

    const exercise = await exerciseRepo.upsert({ assetId: input.assetId, status: 'partial' })

    const problem = await problemRepo.getOrCreate({
      exerciseId: exercise.id,
      idx: input.problemIdx,
    })

    const subproblem = await subproblemRepo.getOrCreate({
      problemId: problem.id,
      label: input.subproblemLabel,
    })

    await attemptRepo.create({
      studySessionId,
      subproblemId: subproblem.id,
      startedAtMs,
      endedAtMs,
      seconds,
      result: input.result,
      note: input.note,
      errorType: input.errorType,
    })

    set((s) => ({
      attemptStartedAtMs: null,
      exerciseStatusByAssetId: {
        ...s.exerciseStatusByAssetId,
        [input.assetId]: exercise.status,
      },
    }))
  },

  reset: () =>
    set({
      studySessionId: null,
      attemptStartedAtMs: null,
      problemIdx: 1,
      subproblemLabel: 'a',
      exerciseStatusByAssetId: {},
    }),
}))

