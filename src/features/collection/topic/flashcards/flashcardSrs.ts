import type { Flashcard, FlashcardReviewRating } from '../../../../domain/models';

const KNOWN_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;
const RELEARN_DELAY_MS = 30 * 60 * 1000;

export function applyFlashcardReview(
  flashcard: Flashcard,
  rating: FlashcardReviewRating,
  nowMs: number,
): Flashcard {
  if (rating === 'unknown') {
    return {
      ...flashcard,
      dueAtMs: nowMs + RELEARN_DELAY_MS,
      updatedAtMs: nowMs,
      lastReviewedAtMs: nowMs,
      intervalDays: 0,
      successStreak: 0,
      reviewCount: flashcard.reviewCount + 1,
    };
  }

  const nextSuccessStreak = flashcard.successStreak + 1;
  const intervalDays =
    KNOWN_INTERVAL_DAYS[Math.min(nextSuccessStreak - 1, KNOWN_INTERVAL_DAYS.length - 1)] ?? 60;

  return {
    ...flashcard,
    dueAtMs: nowMs + intervalDays * 24 * 60 * 60 * 1000,
    updatedAtMs: nowMs,
    lastReviewedAtMs: nowMs,
    intervalDays,
    successStreak: nextSuccessStreak,
    reviewCount: flashcard.reviewCount + 1,
  };
}

export function createInitialFlashcardSchedule(nowMs: number) {
  return {
    dueAtMs: nowMs,
    intervalDays: 0,
    successStreak: 0,
    reviewCount: 0,
    lastReviewedAtMs: undefined,
  };
}

export function formatFlashcardDueLabel(dueAtMs: number, nowMs: number) {
  const deltaMs = dueAtMs - nowMs;
  if (deltaMs <= 0) return 'faellig';
  const deltaHours = Math.round(deltaMs / (60 * 60 * 1000));
  if (deltaHours < 24) return `in ${Math.max(1, deltaHours)}h`;
  const deltaDays = Math.round(deltaMs / (24 * 60 * 60 * 1000));
  return `in ${Math.max(1, deltaDays)}d`;
}
