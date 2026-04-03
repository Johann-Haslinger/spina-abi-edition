import { db } from '../../../db/db';
import type { ExerciseTaskDepth } from '../../../domain/models';
import { attemptRepo, exerciseRepo } from '../../../repositories';
import { formatTaskPath } from './formatTaskPath';

export type AttemptTaskDetail = Awaited<ReturnType<typeof attemptRepo.listDetailsForAsset>>[number];

export async function getAttemptHistoryForAsset(assetId: string): Promise<{
  rows: AttemptTaskDetail[];
  taskDepth: ExerciseTaskDepth;
  latestAttemptIds: Set<string>;
  supersededAttemptIds: Set<string>;
}> {
  const [exercise, rows] = await Promise.all([
    exerciseRepo.getByAsset(assetId),
    attemptRepo.listDetailsForAsset(assetId),
  ]);
  const taskDepth = (exercise?.taskDepth ?? 2) as ExerciseTaskDepth;
  const latestByTaskKey = new Map<string, AttemptTaskDetail>();

  for (const row of rows) {
    latestByTaskKey.set(toAttemptTaskKey(row, taskDepth), row);
  }

  const latestAttemptIds = new Set(Array.from(latestByTaskKey.values(), (row) => row.attempt.id));
  const supersededAttemptIds = new Set(
    rows.map((row) => row.attempt.id).filter((attemptId) => !latestAttemptIds.has(attemptId)),
  );

  return {
    rows,
    taskDepth,
    latestAttemptIds,
    supersededAttemptIds,
  };
}

export async function clearAttemptHistoryForAsset(assetId: string): Promise<void> {
  const exercise = await exerciseRepo.getByAsset(assetId);
  const rows = await attemptRepo.listDetailsForAsset(assetId);
  const attemptIds = rows.map((row) => row.attempt.id);

  await db.transaction(
    'rw',
    [
      db.attempts,
      db.attemptAiReviews,
      db.attemptRequirementLinks,
      db.attemptReviewJobs,
      db.inkStrokes,
      db.scheduledReviews,
      db.exercises,
    ],
    async () => {
      if (attemptIds.length > 0) {
        await db.attemptAiReviews.where('attemptId').anyOf(attemptIds).delete();
        await db.attemptRequirementLinks.where('attemptId').anyOf(attemptIds).delete();
        await db.attemptReviewJobs.where('attemptId').anyOf(attemptIds).delete();
        await db.inkStrokes.where('attemptId').anyOf(attemptIds).delete();
        await db.attempts.bulkDelete(attemptIds);
      }

      await db.scheduledReviews.where('assetId').equals(assetId).delete();

      if (exercise) {
        await db.exercises.update(exercise.id, { status: 'unknown' });
      }
    },
  );
}

export function toAttemptTaskKey(
  row: {
    problemIdx: number;
    subproblemLabel?: string;
    subsubproblemLabel?: string;
  },
  taskDepth: ExerciseTaskDepth,
) {
  return formatTaskPath(row, taskDepth);
}
