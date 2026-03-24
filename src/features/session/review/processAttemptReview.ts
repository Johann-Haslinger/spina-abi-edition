import { db } from '../../../db/db';
import type { Requirement } from '../../../domain/models';
import {
  attemptAiReviewRepo,
  attemptRepo,
  attemptRequirementLinkRepo,
  attemptReviewJobRepo,
  chapterRepo,
  requirementRepo,
  scheduledReviewRepo,
} from '../../../repositories';
import { useNotificationsStore } from '../../../stores/notificationsStore';
import { requestAttemptReview } from '../ai/aiClient';
import { hasAttemptUsedAiHelp, mergeAttemptNotes } from './attemptAiHelp';

export function startAttemptAutoReview(input: {
  attemptId: string;
  assetId: string;
  subjectId: string;
  topicId: string;
  pdfData: Uint8Array;
  attemptImageDataUrl: string;
  problemIdx: number;
  subproblemLabel?: string;
  subsubproblemLabel?: string;
}) {
  void runAttemptAutoReview(input);
}

async function runAttemptAutoReview(input: {
  attemptId: string;
  assetId: string;
  subjectId: string;
  topicId: string;
  pdfData: Uint8Array;
  attemptImageDataUrl: string;
  problemIdx: number;
  subproblemLabel?: string;
  subsubproblemLabel?: string;
}) {
  const notifications = useNotificationsStore.getState();
  const requestedAtMs = Date.now();

  await attemptReviewJobRepo.create({
    attemptId: input.attemptId,
    assetId: input.assetId,
    subjectId: input.subjectId,
    topicId: input.topicId,
    status: 'queued',
    requestedAtMs,
  });
  await attemptRepo.update(input.attemptId, { reviewStatus: 'queued' });

  try {
    const chapters = await chapterRepo.listByTopic(input.topicId);
    const requirements = await requirementRepo.listByChapterIds(
      chapters.map((chapter) => chapter.id),
    );
    const attemptBeforeReview = await attemptRepo.get(input.attemptId);
    const usedAiHelp = hasAttemptUsedAiHelp(attemptBeforeReview?.note);
    const job = await attemptReviewJobRepo.getByAttempt(input.attemptId);
    if (!job) throw new Error('Review-Job konnte nicht angelegt werden');
    await attemptReviewJobRepo.update(job.id, { status: 'processing' });
    await attemptRepo.update(input.attemptId, { reviewStatus: 'processing' });

    const review = await requestAttemptReview({
      attemptId: input.attemptId,
      assetId: input.assetId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      problemIdx: input.problemIdx,
      subproblemLabel: input.subproblemLabel,
      subsubproblemLabel: input.subsubproblemLabel,
      pdfData: input.pdfData,
      attemptImageDataUrl: input.attemptImageDataUrl,
      chapters,
      requirements,
      usedAiHelp,
    });

    const matchedRequirements = resolveRequirements(review.requirements, requirements);
    const progressRequirements = usedAiHelp
      ? matchedRequirements.map((entry) => ({ ...entry, masteryDelta: 0 }))
      : matchedRequirements;
    await attemptRequirementLinkRepo.replaceForAttempt(
      input.attemptId,
      progressRequirements.map((entry) => ({
        requirementId: entry.requirement.id,
        confidence: entry.confidence,
        masteryDelta: entry.masteryDelta,
      })),
    );

    for (const entry of progressRequirements) {
      await requirementRepo.update(entry.requirement.id, {
        mastery: clamp(entry.requirement.mastery + entry.masteryDelta),
      });
    }
    await attachRequirementsToTask(
      input.attemptId,
      progressRequirements.map((entry) => entry.requirement.id),
    );

    await attemptAiReviewRepo.upsert({
      attemptId: input.attemptId,
      score: review.score,
      result: review.result,
      messageToUser: review.messageToUser,
      notes: review.notes,
      errorExplanation: review.errorExplanation,
      solutionExplanation: review.solutionExplanation,
      createdAtMs: Date.now(),
      chapterIds: review.chapterIds,
    });

    const reviewStatus = review.manualFallbackReason ? 'manual_required' : 'done';
    await attemptRepo.update(input.attemptId, {
      result: review.result,
      note: mergeAttemptNotes(attemptBeforeReview?.note, review.notes),
      errorType: review.result === 'wrong' ? 'KI-Analyse: Fehler erkannt' : undefined,
      reviewStatus,
    });
    await attemptReviewJobRepo.update(job.id, {
      status: review.manualFallbackReason ? 'manual_required' : 'completed',
      completedAtMs: Date.now(),
      manualFallbackReason: review.manualFallbackReason,
    });

    const existingScheduledReviews = await scheduledReviewRepo.listBySubject(input.subjectId);
    const pendingForAsset = existingScheduledReviews.filter(
      (entry) => entry.assetId === input.assetId && entry.status === 'pending',
    );
    if (review.result !== 'wrong') {
      await Promise.all(
        pendingForAsset.map((entry) => scheduledReviewRepo.markCompleted(entry.id, Date.now())),
      );
    }

    if (review.scheduleReview) {
      await scheduledReviewRepo.upsert({
        subjectId: input.subjectId,
        topicId: input.topicId,
        assetId: input.assetId,
        requirementId: progressRequirements[0]?.requirement.id,
        attemptId: input.attemptId,
        dueAtMs: review.scheduleReview.dueAtMs,
        status: 'pending',
      });
      notifications.push({
        tone: 'warning',
        title: 'Wiederholung eingeplant',
        message: 'Die Aufgabe wurde auf deine Wiederholungsliste gesetzt.',
      });
    }

    notifications.push({
      tone:
        review.result === 'correct' ? 'success' : review.result === 'partial' ? 'warning' : 'error',
      title: 'KI-Bewertung abgeschlossen',
      message: review.messageToUser || review.notes || 'Die Analyse ist jetzt verfügbar.',
      details:
        review.result === 'correct'
          ? {
              kind: 'attemptReviewSuccess',
              score: review.score,
              messageToUser: review.messageToUser,
              notes: review.notes,
              solutionExplanation: review.solutionExplanation,
              requirementUpdates: progressRequirements
                .filter((entry) => entry.masteryDelta !== 0)
                .map((entry) => ({
                  requirementId: entry.requirement.id,
                  requirementName: entry.requirement.name,
                  masteryDelta: entry.masteryDelta,
                })),
            }
          : undefined,
      action:
        review.result === 'correct'
          ? undefined
          : {
              kind: 'openAttemptReview',
              subjectId: input.subjectId,
              topicId: input.topicId,
              assetId: input.assetId,
              attemptId: input.attemptId,
            },
    });

    if (review.result !== 'correct' && (review.errorExplanation || review.solutionExplanation)) {
      useNotificationsStore.getState().openAttemptReview({
        subjectId: input.subjectId,
        topicId: input.topicId,
        assetId: input.assetId,
        attemptId: input.attemptId,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KI-Bewertung fehlgeschlagen';
    const job = await attemptReviewJobRepo.getByAttempt(input.attemptId);
    if (job) {
      await attemptReviewJobRepo.update(job.id, {
        status: 'failed',
        completedAtMs: Date.now(),
        error: message,
      });
    }
    await attemptRepo.update(input.attemptId, {
      reviewStatus: 'manual_required',
      note: mergeAttemptNotes((await attemptRepo.get(input.attemptId))?.note, message),
    });
    notifications.push({
      tone: 'error',
      title: 'KI-Bewertung fehlgeschlagen',
      message: 'Bitte bewerte diese Aufgabe manuell im Review.',
    });
  }
}

function resolveRequirements(
  reviewRequirements: Array<{
    requirementId?: string;
    requirementName: string;
    confidence: number;
    masteryDelta: number;
  }>,
  requirements: Requirement[],
) {
  return reviewRequirements
    .map((entry) => {
      const requirement =
        (entry.requirementId
          ? requirements.find((candidate) => candidate.id === entry.requirementId)
          : undefined) ??
        requirements.find(
          (candidate) =>
            candidate.name.trim().toLowerCase() === entry.requirementName.trim().toLowerCase(),
        );
      return requirement
        ? { requirement, confidence: entry.confidence, masteryDelta: entry.masteryDelta }
        : null;
    })
    .filter(
      (entry): entry is { requirement: Requirement; confidence: number; masteryDelta: number } =>
        Boolean(entry),
    );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function attachRequirementsToTask(attemptId: string, requirementIds: string[]) {
  const attempt = await attemptRepo.get(attemptId);
  if (!attempt || requirementIds.length === 0) return;
  const subproblem = await db.subproblems.get(attempt.subproblemId);
  if (!subproblem) return;
  const hasExplicitSubproblem = subproblem.label.trim().length > 0;
  const uniqueRequirementIds = Array.from(new Set(requirementIds));

  if (hasExplicitSubproblem && attempt.subsubproblemId) {
    const subsubproblem = await db.subsubproblems.get(attempt.subsubproblemId);
    if (subsubproblem) {
      await db.subsubproblems.put({
        ...subsubproblem,
        requirementIds: mergeRequirementIds(subsubproblem.requirementIds, uniqueRequirementIds),
      });
      return;
    }
  }

  if (hasExplicitSubproblem) {
    await db.subproblems.put({
      ...subproblem,
      requirementIds: mergeRequirementIds(subproblem.requirementIds, uniqueRequirementIds),
    });
    return;
  }

  const problem = await db.problems.get(subproblem.problemId);
  if (!problem) return;
  await db.problems.put({
    ...problem,
    requirementIds: mergeRequirementIds(problem.requirementIds, uniqueRequirementIds),
  });
}

function mergeRequirementIds(current: string[] | undefined, incoming: string[]) {
  return Array.from(new Set([...(current ?? []), ...incoming]));
}
