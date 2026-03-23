import { IndexedDbAssetFileStore } from './local/IndexedDbAssetFileStore';
import {
  LocalAssetRepository,
  LocalFolderRepository,
  LocalSubjectRepository,
  LocalTopicRepository,
} from './local/LocalRepositories';
import {
  LocalChapterRepository,
  LocalCurriculumDocumentRepository,
  LocalRequirementRepository,
  LocalScheduledReviewRepository,
} from './local/LocalCurriculumRepositories';
import { LocalInkRepository } from './study/local/LocalInkRepository';
import {
  LocalAttemptAiReviewRepository,
  LocalAttemptRequirementLinkRepository,
  LocalAttemptRepository,
  LocalAttemptReviewJobRepository,
  LocalExerciseRepository,
  LocalProblemRepository,
  LocalStudySessionRepository,
  LocalSubproblemRepository,
  LocalSubsubproblemRepository,
} from './study/local/LocalStudyRepositories';
import { LocalPlannedItemRepository } from './planning/local/LocalPlannedItemRepository';

export const subjectRepo = new LocalSubjectRepository();
export const topicRepo = new LocalTopicRepository();
export const folderRepo = new LocalFolderRepository();
export const assetRepo = new LocalAssetRepository();
export const assetFileStore = new IndexedDbAssetFileStore();
export const curriculumDocumentRepo = new LocalCurriculumDocumentRepository();
export const chapterRepo = new LocalChapterRepository();
export const requirementRepo = new LocalRequirementRepository();

export const studySessionRepo = new LocalStudySessionRepository();
export const exerciseRepo = new LocalExerciseRepository();
export const problemRepo = new LocalProblemRepository();
export const subproblemRepo = new LocalSubproblemRepository();
export const subsubproblemRepo = new LocalSubsubproblemRepository();
export const attemptRepo = new LocalAttemptRepository();
export const attemptReviewJobRepo = new LocalAttemptReviewJobRepository();
export const attemptAiReviewRepo = new LocalAttemptAiReviewRepository();
export const attemptRequirementLinkRepo = new LocalAttemptRequirementLinkRepository();
export const inkRepo = new LocalInkRepository();

export const plannedItemRepo = new LocalPlannedItemRepository();
export const scheduledReviewRepo = new LocalScheduledReviewRepository();