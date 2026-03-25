export type TopicSummaryExerciseStatusCounts = {
  unknown: number;
  partial: number;
  captured: number;
  covered: number;
};

export type TopicSummaryChapter = {
  name: string;
  avgMastery: number;
  requirementCount: number;
};

export type TopicSummaryWeakest = {
  name: string;
  mastery: number;
};

export type TopicSummaryPayload = {
  topicName?: string;
  subjectName?: string;
  avgRequirementMastery: number;
  requirementCount: number;
  weakRequirementCount: number;
  chapters: TopicSummaryChapter[];
  weakest: TopicSummaryWeakest[];
  completedSessionCount: number;
  totalAttempts: number;
  totalWorkTimeFormatted: string;
  exerciseAssetCount: number;
  exerciseStatusCounts: TopicSummaryExerciseStatusCounts;
  unknownExerciseRatio: number;
};

export type TopicSummaryRequest = {
  topic: TopicSummaryPayload;
};

export type TopicSummaryResponse = {
  summary: string;
};
