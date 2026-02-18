import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AttemptResult, ExercisePageStatus } from '../../../domain/models';
import {
  attemptRepo,
  exerciseRepo,
  problemRepo,
  studySessionRepo,
  subproblemRepo,
} from '../../../repositories';

function getSessionKey(input: { subjectId: string; topicId: string; startedAtMs: number }) {
  return `${input.subjectId}:${input.topicId}:${input.startedAtMs}`;
}

type CurrentAttempt = {
  startedAtMs: number;
  assetId?: string;
  problemIdx: number;
  subproblemLabel: string;
};

type StudyState = {
  boundSessionKey: string | null;
  studySessionId: string | null;
  currentAttempt: CurrentAttempt | null;
  problemIdx: number;
  subproblemLabel: string;
  exerciseStatusByAssetId: Record<string, ExercisePageStatus>;

  bindToSession: (input: { subjectId: string; topicId: string; startedAtMs: number }) => void;

  ensureStudySession: (input: {
    subjectId: string;
    topicId: string;
    startedAtMs: number;
    plannedDurationMs?: number;
  }) => Promise<string>;

  setProblemIdx: (idx: number) => void;
  setSubproblemLabel: (label: string) => void;

  startAttempt: (input?: { assetId?: string; problemIdx?: number; subproblemLabel?: string }) => void;
  cancelAttempt: () => void;

  loadExerciseStatus: (assetId: string) => Promise<void>;
  setExerciseStatus: (assetId: string, status: ExercisePageStatus) => Promise<void>;

  logAttempt: (input: {
    assetId?: string;
    problemIdx?: number;
    subproblemLabel?: string;
    endedAtMs: number;
    result: AttemptResult;
    note?: string;
    errorType?: string;
  }) => Promise<void>;

  reset: () => void;
};

type PersistedStudyState = Pick<
  StudyState,
  | 'boundSessionKey'
  | 'studySessionId'
  | 'currentAttempt'
  | 'problemIdx'
  | 'subproblemLabel'
  | 'exerciseStatusByAssetId'
>;

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      boundSessionKey: null,
      studySessionId: null,
      currentAttempt: null,
      problemIdx: 1,
      subproblemLabel: 'a',
      exerciseStatusByAssetId: {},

      bindToSession: (input) =>
        set((s) => {
          const key = getSessionKey(input);
          if (s.boundSessionKey === key) return s;
          return {
            boundSessionKey: key,
            studySessionId: null,
            currentAttempt: null,
            problemIdx: 1,
            subproblemLabel: 'a',
            exerciseStatusByAssetId: {},
          };
        }),

      ensureStudySession: async ({ subjectId, topicId, startedAtMs, plannedDurationMs }) => {
        const key = getSessionKey({ subjectId, topicId, startedAtMs });
        const current = get();
        if (current.boundSessionKey !== key) {
          current.bindToSession({ subjectId, topicId, startedAtMs });
        }

        const existing = get().studySessionId;
        if (existing) return existing;
        const created = await studySessionRepo.create({
          subjectId,
          topicId,
          startedAtMs,
          plannedDurationMs,
        });
        set({ studySessionId: created.id });
        return created.id;
      },

      setProblemIdx: (idx) => set({ problemIdx: idx }),
      setSubproblemLabel: (label) => set({ subproblemLabel: label }),

      startAttempt: (input) => {
        if (get().currentAttempt) return;
        const startedAtMs = Date.now();
        const snapshotProblemIdx = input?.problemIdx ?? get().problemIdx;
        const snapshotSubproblemLabel = input?.subproblemLabel ?? get().subproblemLabel;
        set({
          currentAttempt: {
            startedAtMs,
            assetId: input?.assetId,
            problemIdx: snapshotProblemIdx,
            subproblemLabel: snapshotSubproblemLabel,
          },
        });
      },

      cancelAttempt: () => set({ currentAttempt: null }),

      loadExerciseStatus: async (assetId) => {
        const ex = await exerciseRepo.getByAsset(assetId);
        set((s) => ({
          exerciseStatusByAssetId: {
            ...s.exerciseStatusByAssetId,
            [assetId]: ex?.status ?? 'unknown',
          },
        }));
      },

      setExerciseStatus: async (assetId, status) => {
        const ex = await exerciseRepo.upsert({ assetId, status });
        set((s) => ({
          exerciseStatusByAssetId: { ...s.exerciseStatusByAssetId, [assetId]: ex.status },
        }));
      },

      logAttempt: async (input) => {
        const { studySessionId, currentAttempt } = get();
        if (!studySessionId) throw new Error('No studySessionId');
        if (!currentAttempt) throw new Error('No running attempt');

        const startedAtMs = currentAttempt.startedAtMs;
        const endedAtMs = input.endedAtMs;
        const seconds = Math.max(1, Math.round((endedAtMs - startedAtMs) / 1000));

        const assetId = input.assetId ?? currentAttempt.assetId;
        if (!assetId) throw new Error('No assetId for attempt');

        const problemIdx = input.problemIdx ?? currentAttempt.problemIdx;
        const subproblemLabel = input.subproblemLabel ?? currentAttempt.subproblemLabel;

        const exercise = await exerciseRepo.upsert({ assetId, status: 'partial' });

        const problem = await problemRepo.getOrCreate({
          exerciseId: exercise.id,
          idx: problemIdx,
        });

        const subproblem = await subproblemRepo.getOrCreate({
          problemId: problem.id,
          label: subproblemLabel,
        });

        await attemptRepo.create({
          studySessionId,
          subproblemId: subproblem.id,
          startedAtMs,
          endedAtMs,
          seconds,
          result: input.result,
          note: input.note,
          errorType: input.errorType,
        });

        set((s) => ({
          currentAttempt: null,
          exerciseStatusByAssetId: {
            ...s.exerciseStatusByAssetId,
            [assetId]: exercise.status,
          },
        }));
      },

      reset: () =>
        set({
          boundSessionKey: null,
          studySessionId: null,
          currentAttempt: null,
          problemIdx: 1,
          subproblemLabel: 'a',
          exerciseStatusByAssetId: {},
        }),
    }),
    {
      name: 'mathe-abi-2026:study-store',
      version: 2,
      migrate: (persisted, version) => {
        // v1 stored `attemptStartedAtMs`; v2 uses `currentAttempt`.
        if (version === 1 && persisted && typeof persisted === 'object') {
          const p = persisted as PersistedStudyState & {
            attemptStartedAtMs?: number | null;
          };
          if (!p.currentAttempt && p.attemptStartedAtMs) {
            return {
              ...(persisted as PersistedStudyState),
              currentAttempt: {
                startedAtMs: p.attemptStartedAtMs,
                problemIdx: p.problemIdx ?? 1,
                subproblemLabel: p.subproblemLabel ?? 'a',
              },
            };
          }
        }
        return persisted as PersistedStudyState;
      },
      partialize: (s) => ({
        boundSessionKey: s.boundSessionKey,
        studySessionId: s.studySessionId,
        currentAttempt: s.currentAttempt,
        problemIdx: s.problemIdx,
        subproblemLabel: s.subproblemLabel,
        exerciseStatusByAssetId: s.exerciseStatusByAssetId,
      }),
    },
  ),
);
