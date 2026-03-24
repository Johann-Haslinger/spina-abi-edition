export type ReviewSummaryAttemptResult = 'correct' | 'partial' | 'wrong';

export type ReviewSummaryExerciseTotals = {
  attempts: number;
  correct: number;
  partial: number;
  wrong: number;
  /** z. B. "12 Min" oder "1 Std 20 Min" — für die KI, nicht Sekunden */
  workTime: string;
};

export type ReviewSummaryExerciseItem = {
  path: string;
  result: ReviewSummaryAttemptResult;
  /** z. B. "3 Min" — für die KI */
  duration: string;
  aiScore?: number;
};

export type ReviewSummaryExercisePayload = {
  title: string;
  totals: ReviewSummaryExerciseTotals;
  items: ReviewSummaryExerciseItem[];
};

export type ReviewSummarySessionExercise = {
  title: string;
  totals: ReviewSummaryExerciseTotals;
};

export type ReviewSummaryTopicChapter = {
  name: string;
  avgMastery: number;
  requirementCount: number;
};

export type ReviewSummaryTopicWeakest = {
  name: string;
  mastery: number;
};

export type ReviewSummaryTopicContext = {
  topicName?: string;
  avgRequirementMastery: number;
  chapters: ReviewSummaryTopicChapter[];
  weakest: ReviewSummaryTopicWeakest[];
};

export type ReviewSummarySessionPayload = {
  /** Session-Gesamtdauer (Wandzeit), z. B. "45 Min" */
  sessionDuration: string;
  /** Summe Arbeitszeit an Aufgaben */
  workTime: string;
  exerciseCount: number;
  totals: ReviewSummaryExerciseTotals;
  exercises: ReviewSummarySessionExercise[];
  topicContext: ReviewSummaryTopicContext;
};

export type ReviewSummaryRequest =
  | { scope: 'exercise'; exercise: ReviewSummaryExercisePayload }
  | { scope: 'session'; session: ReviewSummarySessionPayload };

export type ReviewSummaryResponse = {
  headline: string;
  summary: string;
  tip: string;
  focusAreas: string[];
};
