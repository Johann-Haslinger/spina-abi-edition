import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../../../db/db';
import type { AttemptResult, ExercisePageStatus, ExerciseTaskDepth } from '../../../domain/models';
import { newId } from '../../../lib/id';
import {
  attemptRepo,
  exerciseRepo,
  problemRepo,
  studySessionRepo,
  subproblemRepo,
  subsubproblemRepo,
} from '../../../repositories';

function getSessionKey(input: { subjectId: string; topicId: string; startedAtMs: number }) {
  return `${input.subjectId}:${input.topicId}:${input.startedAtMs}`;
}

type CurrentAttempt = {
  attemptId: string;
  startedAtMs: number;
  assetId?: string;
  problemIdx: number;
  subproblemLabel: string;
  subsubproblemLabel: string;
};

type StudyState = {
  boundSessionKey: string | null;
  studySessionId: string | null;
  currentAttempt: CurrentAttempt | null;
  problemIdx: number;
  subproblemLabel: string;
  subsubproblemLabel: string;
  exerciseStatusByAssetId: Record<string, ExercisePageStatus>;
  taskDepthByAssetId: Record<string, ExerciseTaskDepth>;

  bindToSession: (input: { subjectId: string; topicId: string; startedAtMs: number }) => void;

  ensureStudySession: (input: {
    subjectId: string;
    topicId: string;
    startedAtMs: number;
    plannedDurationMs?: number;
  }) => Promise<string>;

  setProblemIdx: (idx: number) => void;
  setSubproblemLabel: (label: string) => void;
  setSubsubproblemLabel: (label: string) => void;

  loadTaskDepth: (assetId: string) => Promise<void>;
  setTaskDepth: (assetId: string, depth: ExerciseTaskDepth) => Promise<void>;
  decreaseTaskDepthWithCleanup: (assetId: string, nextDepth: ExerciseTaskDepth) => Promise<void>;

  startAttempt: (input?: {
    assetId?: string;
    problemIdx?: number;
    subproblemLabel?: string;
    subsubproblemLabel?: string;
  }) => void;
  cancelAttempt: () => void;

  loadExerciseStatus: (assetId: string) => Promise<void>;
  setExerciseStatus: (assetId: string, status: ExercisePageStatus) => Promise<void>;

  logAttempt: (input: {
    assetId?: string;
    problemIdx?: number;
    subproblemLabel?: string;
    subsubproblemLabel?: string;
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
  | 'subsubproblemLabel'
  | 'exerciseStatusByAssetId'
  | 'taskDepthByAssetId'
>;

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      boundSessionKey: null,
      studySessionId: null,
      currentAttempt: null,
      problemIdx: 1,
      subproblemLabel: 'a',
      subsubproblemLabel: '1',
      exerciseStatusByAssetId: {},
      taskDepthByAssetId: {},

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
            subsubproblemLabel: '1',
            exerciseStatusByAssetId: {},
            taskDepthByAssetId: {},
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
      setSubsubproblemLabel: (label) => set({ subsubproblemLabel: label }),

      loadTaskDepth: async (assetId) => {
        const ex = await exerciseRepo.getByAsset(assetId);
        const depth = (ex?.taskDepth ?? 2) as ExerciseTaskDepth;
        set((s) => ({
          taskDepthByAssetId: { ...s.taskDepthByAssetId, [assetId]: depth },
        }));
      },

      setTaskDepth: async (assetId, depth) => {
        const ex = await exerciseRepo.setTaskDepthByAsset(assetId, depth);
        set((s) => ({
          taskDepthByAssetId: {
            ...s.taskDepthByAssetId,
            [assetId]: (ex.taskDepth ?? depth) as ExerciseTaskDepth,
          },
        }));
      },

      decreaseTaskDepthWithCleanup: async (assetId, nextDepth) => {
        const ex = await exerciseRepo.getByAsset(assetId);
        const currentDepth = (ex?.taskDepth ??
          get().taskDepthByAssetId[assetId] ??
          2) as ExerciseTaskDepth;
        if (nextDepth >= currentDepth) {
          await get().setTaskDepth(assetId, nextDepth);
          return;
        }

        const exercise = ex ?? (await exerciseRepo.setTaskDepthByAsset(assetId, currentDepth));
        const problems = await db.problems.where('exerciseId').equals(exercise.id).toArray();
        const problemIds = problems.map((p) => p.id);
        const subproblems =
          problemIds.length > 0
            ? await db.subproblems.where('problemId').anyOf(problemIds).toArray()
            : [];
        const subproblemIds = subproblems.map((sp) => sp.id);

        const attempts =
          subproblemIds.length > 0
            ? await db.attempts.where('subproblemId').anyOf(subproblemIds).toArray()
            : [];

        const labelBySubId = new Map(subproblems.map((sp) => [sp.id, sp.label]));
        const problemIdBySubId = new Map(subproblems.map((sp) => [sp.id, sp.problemId]));

        if (currentDepth === 3 && nextDepth === 2) {
          const toRemap = attempts.filter((a) => Boolean(a.subsubproblemId));
          if (toRemap.length) {
            const updated = toRemap.map((a) => ({ ...a, subsubproblemId: undefined }));
            await db.attempts.bulkPut(updated);
          }
        } else if (currentDepth >= 2 && nextDepth === 1) {
          const defaultSubByProblemId = new Map<string, string>();
          for (const p of problems) {
            const defaultSub = await subproblemRepo.getOrCreate({
              problemId: p.id,
              label: '',
            });
            defaultSubByProblemId.set(p.id, defaultSub.id);
          }
          const toRemap = attempts.filter((a) => {
            if (a.subsubproblemId) return true;
            const lbl = (labelBySubId.get(a.subproblemId) ?? '').trim();
            return lbl !== '';
          });
          if (toRemap.length) {
            const updated = toRemap.map((a) => {
              const problemId = problemIdBySubId.get(a.subproblemId);
              const defaultSubId = problemId ? defaultSubByProblemId.get(problemId) : undefined;
              return {
                ...a,
                subproblemId: defaultSubId ?? a.subproblemId,
                subsubproblemId: undefined,
              };
            });
            await db.attempts.bulkPut(updated);
          }
        }

        if (nextDepth <= 2) {
          if (subproblemIds.length) {
            await db.subsubproblems.where('subproblemId').anyOf(subproblemIds).delete();
          }
        }

        if (nextDepth === 1) {
          const subproblemIdsToDelete = subproblems
            .filter((sp) => sp.label.trim() !== '')
            .map((sp) => sp.id);
          if (subproblemIdsToDelete.length) {
            await db.subproblems.bulkDelete(subproblemIdsToDelete);
          }
        }

        await get().setTaskDepth(assetId, nextDepth);
      },

      startAttempt: (input) => {
        if (get().currentAttempt) return;
        const startedAtMs = Date.now();
        const snapshotProblemIdx = input?.problemIdx ?? get().problemIdx;
        const snapshotSubproblemLabel = input?.subproblemLabel ?? get().subproblemLabel;
        const snapshotSubsubproblemLabel = input?.subsubproblemLabel ?? get().subsubproblemLabel;
        set({
          currentAttempt: {
            attemptId: newId(),
            startedAtMs,
            assetId: input?.assetId,
            problemIdx: snapshotProblemIdx,
            subproblemLabel: snapshotSubproblemLabel,
            subsubproblemLabel: snapshotSubsubproblemLabel,
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
        const subsubproblemLabel = input.subsubproblemLabel ?? currentAttempt.subsubproblemLabel;

        const exercise = await exerciseRepo.upsert({ assetId, status: 'partial' });
        const depth = (exercise.taskDepth ??
          get().taskDepthByAssetId[assetId] ??
          2) as ExerciseTaskDepth;

        const problem = await problemRepo.getOrCreate({
          exerciseId: exercise.id,
          idx: problemIdx,
        });

        const subproblem = await subproblemRepo.getOrCreate({
          problemId: problem.id,
          label: depth === 1 ? '' : subproblemLabel,
        });

        const subsubproblemId =
          depth === 3
            ? (
                await subsubproblemRepo.getOrCreate({
                  subproblemId: subproblem.id,
                  label: subsubproblemLabel,
                })
              ).id
            : undefined;

        await attemptRepo.create({
          id: currentAttempt.attemptId,
          studySessionId,
          subproblemId: subproblem.id,
          subsubproblemId,
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
          subsubproblemLabel: '1',
          exerciseStatusByAssetId: {},
          taskDepthByAssetId: {},
        }),
    }),
    {
      name: 'mathe-abi-2026:study-store',
      version: 4,
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
                attemptId: newId(),
                startedAtMs: p.attemptStartedAtMs,
                problemIdx: p.problemIdx ?? 1,
                subproblemLabel: p.subproblemLabel ?? 'a',
              },
            };
          }
        }
        // v3 adds `attemptId` to `currentAttempt`.
        if (version === 2 && persisted && typeof persisted === 'object') {
          const p = persisted as PersistedStudyState;
          if (p.currentAttempt && !('attemptId' in p.currentAttempt)) {
            return {
              ...(persisted as PersistedStudyState),
              currentAttempt: {
                ...(p.currentAttempt as Omit<CurrentAttempt, 'attemptId'>),
                attemptId: newId(),
              },
            };
          }
        }
        // v4 adds task depth + 3rd-level label.
        if (version === 3 && persisted && typeof persisted === 'object') {
          const p = persisted as PersistedStudyState & {
            subsubproblemLabel?: unknown;
            taskDepthByAssetId?: unknown;
          };
          const caUnknown = (p.currentAttempt ?? null) as unknown;
          const migratedCurrentAttempt: CurrentAttempt | null =
            caUnknown && typeof caUnknown === 'object'
              ? (() => {
                  const ca = caUnknown as Omit<CurrentAttempt, 'subsubproblemLabel'> & {
                    subsubproblemLabel?: unknown;
                  };
                  return {
                    ...(ca as Omit<CurrentAttempt, 'subsubproblemLabel'>),
                    subsubproblemLabel:
                      typeof ca.subsubproblemLabel === 'string' ? ca.subsubproblemLabel : '1',
                  } satisfies CurrentAttempt;
                })()
              : null;
          return {
            ...(persisted as PersistedStudyState),
            subsubproblemLabel:
              typeof p.subsubproblemLabel === 'string' ? p.subsubproblemLabel : '1',
            taskDepthByAssetId:
              p.taskDepthByAssetId && typeof p.taskDepthByAssetId === 'object'
                ? (p.taskDepthByAssetId as Record<string, ExerciseTaskDepth>)
                : {},
            currentAttempt: migratedCurrentAttempt,
          };
        }
        return persisted as PersistedStudyState;
      },
      partialize: (s) => ({
        boundSessionKey: s.boundSessionKey,
        studySessionId: s.studySessionId,
        currentAttempt: s.currentAttempt,
        problemIdx: s.problemIdx,
        subproblemLabel: s.subproblemLabel,
        subsubproblemLabel: s.subsubproblemLabel,
        exerciseStatusByAssetId: s.exerciseStatusByAssetId,
        taskDepthByAssetId: s.taskDepthByAssetId,
      }),
    },
  ),
);
