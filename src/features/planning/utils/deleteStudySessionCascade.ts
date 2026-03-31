import { db } from '../../../db/db';

/** Entfernt eine abgeschlossene Lernsession inkl. Versuche, Reviews und Ink aus der lokalen DB. */
export async function deleteStudySessionCascade(studySessionId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.studySessions,
      db.attempts,
      db.attemptRequirementLinks,
      db.attemptAiReviews,
      db.attemptReviewJobs,
      db.inkStrokes,
    ],
    async () => {
      const attemptIds = await db.attempts
        .where('studySessionId')
        .equals(studySessionId)
        .primaryKeys();
      if (attemptIds.length > 0) {
        const ids = attemptIds as string[];
        await db.attemptRequirementLinks.where('attemptId').anyOf(ids).delete();
        await db.attemptAiReviews.where('attemptId').anyOf(ids).delete();
        await db.attemptReviewJobs.where('attemptId').anyOf(ids).delete();
        await db.attempts.bulkDelete(ids);
      }
      await db.inkStrokes.where('studySessionId').equals(studySessionId).delete();
      await db.studySessions.delete(studySessionId);
    },
  );
}
