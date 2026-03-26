import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  AssetFile,
  Attempt,
  AttemptAiReview,
  AttemptRequirementLink,
  AttemptReviewJob,
  Chapter,
  CurriculumDocument,
  Exercise,
  Folder,
  InkStroke,
  OpenAiPdfFileCache,
  PlannedItem,
  Problem,
  Requirement,
  ScheduledReview,
  StudySession,
  Subject,
  Subproblem,
  Subsubproblem,
  Topic,
} from '../domain/models';
import { SubjectColorId } from '../domain/models';

export class AbiDb extends Dexie {
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  folders!: Table<Folder, string>;
  assets!: Table<Asset, string>;
  assetFiles!: Table<AssetFile, string>;
  curriculumDocuments!: Table<CurriculumDocument, string>;
  chapters!: Table<Chapter, string>;
  requirements!: Table<Requirement, string>;

  studySessions!: Table<StudySession, string>;
  exercises!: Table<Exercise, string>;
  problems!: Table<Problem, string>;
  subproblems!: Table<Subproblem, string>;
  subsubproblems!: Table<Subsubproblem, string>;
  attempts!: Table<Attempt, string>;
  attemptRequirementLinks!: Table<AttemptRequirementLink, string>;
  attemptAiReviews!: Table<AttemptAiReview, string>;
  attemptReviewJobs!: Table<AttemptReviewJob, string>;
  inkStrokes!: Table<InkStroke, string>;
  openAiPdfFileCache!: Table<OpenAiPdfFileCache, string>;

  plannedItems!: Table<PlannedItem, string>;
  scheduledReviews!: Table<ScheduledReview, string>;

  constructor() {
    super('abi-lernapp');

    this.version(1).stores({
      subjects: 'id, createdAtMs',
      topics: 'id, subjectId, orderIndex, createdAtMs',
      folders: 'id, topicId, parentFolderId, orderIndex, createdAtMs',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',
    });

    this.version(2).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',
    });

    this.version(3).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',

      studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
      exercisePages: 'id, [assetId+pageNumber], assetId, pageNumber, status',
      problems: 'id, [pageId+idx], pageId, idx',
      subproblems: 'id, [problemId+label], problemId, label',
      attempts: 'id, studySessionId, subproblemId, startedAtMs, endedAtMs, result',
    });

    // v4: Page numbers are viewer-only. Persist exercise-level status and problems.
    // Data loss is acceptable; we drop the old exercisePages table.
    this.version(4).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',

      studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
      exercises: 'id, assetId, status',
      problems: 'id, [exerciseId+idx], exerciseId, idx',
      subproblems: 'id, [problemId+label], problemId, label',
      attempts: 'id, studySessionId, subproblemId, startedAtMs, endedAtMs, result',
    });

    // v5: Clear legacy/invalid study data from pre-refactor schemas.
    // This avoids "attempts exist but don't show in reviews" due to old rows
    // that still reference page-based fields (pageId) instead of exerciseId.
    this.version(5)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        attempts: 'id, studySessionId, subproblemId, startedAtMs, endedAtMs, result',
      })
      .upgrade(async (tx) => {
        await tx.table('attempts').clear();
        await tx.table('subproblems').clear();
        await tx.table('problems').clear();
        await tx.table('exercises').clear();
        await tx.table('studySessions').clear();
      });

    // v6: Reset legacy subject colors (hex strings) to the new token assignment model.
    this.version(6)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        attempts: 'id, studySessionId, subproblemId, startedAtMs, endedAtMs, result',
      })
      .upgrade(async (tx) => {
        await tx
          .table('subjects')
          .toCollection()
          .modify({
            color: { colorId: SubjectColorId.DarkBlue },
          });
      });

    this.version(7)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        attempts: 'id, studySessionId, subproblemId, startedAtMs, endedAtMs, result',
      })
      .upgrade(async (tx) => {
        await tx
          .table('subjects')
          .toCollection()
          .modify((s: { color?: unknown }) => {
            const c = s.color;
            if (c && typeof c === 'object' && 'toneOrder' in c) {
              delete (c as Record<string, unknown>).toneOrder;
            }
          });
      });

    this.version(8).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',

      studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
      exercises: 'id, assetId, status',
      problems: 'id, [exerciseId+idx], exerciseId, idx',
      subproblems: 'id, [problemId+label], problemId, label',
      attempts: 'id, studySessionId, subproblemId, startedAtMs, endedAtMs, result',

      inkStrokes:
        'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',
    });

    this.version(9)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        subsubproblems: 'id, [subproblemId+label], subproblemId, label',
        attempts:
          'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result',

        inkStrokes:
          'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: { taskDepth?: unknown }) => {
            if (typeof ex.taskDepth !== 'number') ex.taskDepth = 2;
          });
      });

    // v10: Planning calendar (future sessions + events)
    this.version(10).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',

      studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
      exercises: 'id, assetId, status',
      problems: 'id, [exerciseId+idx], exerciseId, idx',
      subproblems: 'id, [problemId+label], problemId, label',
      subsubproblems: 'id, [subproblemId+label], subproblemId, label',
      attempts: 'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result',

      inkStrokes:
        'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',

      plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
    });

    this.version(11)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
        chapters: 'id, topicId, orderIndex',
        requirements: 'id, chapterId, difficulty, mastery',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        subsubproblems: 'id, [subproblemId+label], subproblemId, label',
        attempts:
          'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
        attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
        attemptAiReviews: 'id, attemptId, result, createdAtMs',
        attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

        inkStrokes:
          'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',

        plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
        scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
      })
      .upgrade(async (tx) => {
        await tx
          .table('attempts')
          .toCollection()
          .modify((attempt: { reviewStatus?: unknown }) => {
            if (typeof attempt.reviewStatus !== 'string') attempt.reviewStatus = 'none';
          });
      });

    this.version(12).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',

      curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
      chapters: 'id, topicId, orderIndex',
      requirements: 'id, chapterId, difficulty, mastery',

      studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
      exercises: 'id, assetId, status',
      problems: 'id, [exerciseId+idx], exerciseId, idx',
      subproblems: 'id, [problemId+label], problemId, label',
      subsubproblems: 'id, [subproblemId+label], subproblemId, label',
      attempts:
        'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
      attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
      attemptAiReviews: 'id, attemptId, result, createdAtMs',
      attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

      inkStrokes:
        'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',

      plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
      scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
    });

    this.version(13)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
        chapters: 'id, topicId, orderIndex',
        requirements: 'id, chapterId, difficulty, mastery',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        subsubproblems: 'id, [subproblemId+label], subproblemId, label',
        attempts:
          'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
        attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
        attemptAiReviews: 'id, attemptId, result, createdAtMs',
        attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

        inkStrokes:
          'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',

        plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
        scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
      })
      .upgrade(async (tx) => {
        await tx
          .table('problems')
          .toCollection()
          .modify((row: { requirementIds?: unknown }) => {
            if (!Array.isArray(row.requirementIds)) row.requirementIds = [];
          });
        await tx
          .table('subproblems')
          .toCollection()
          .modify((row: { requirementIds?: unknown }) => {
            if (!Array.isArray(row.requirementIds)) row.requirementIds = [];
          });
        await tx
          .table('subsubproblems')
          .toCollection()
          .modify((row: { requirementIds?: unknown }) => {
            if (!Array.isArray(row.requirementIds)) row.requirementIds = [];
          });
        await tx
          .table('attempts')
          .toCollection()
          .modify((row: { writtenAnswer?: unknown }) => {
            if ('writtenAnswer' in row) delete row.writtenAnswer;
          });
      });

    this.version(14).stores({
      subjects: 'id, name',
      topics: 'id, subjectId, orderIndex',
      folders: 'id, topicId, parentFolderId, orderIndex',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',

      curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
      chapters: 'id, topicId, orderIndex',
      requirements: 'id, chapterId, difficulty, mastery',

      studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
      exercises: 'id, assetId, status',
      problems: 'id, [exerciseId+idx], exerciseId, idx',
      subproblems: 'id, [problemId+label], problemId, label',
      subsubproblems: 'id, [subproblemId+label], subproblemId, label',
      attempts:
        'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
      attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
      attemptAiReviews: 'id, attemptId, result, createdAtMs',
      attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

      inkStrokes:
        'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',
      openAiPdfFileCache: 'pdfSha256, updatedAtMs',

      plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
      scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
    });

    // v15: exercises.difficulty (Leicht/Mittel/Schwer, default 2)
    this.version(15)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
        chapters: 'id, topicId, orderIndex',
        requirements: 'id, chapterId, difficulty, mastery',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        subsubproblems: 'id, [subproblemId+label], subproblemId, label',
        attempts:
          'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
        attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
        attemptAiReviews: 'id, attemptId, result, createdAtMs',
        attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

        inkStrokes:
          'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',
        openAiPdfFileCache: 'pdfSha256, updatedAtMs',

        plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
        scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: { difficulty?: unknown }) => {
            const d = ex.difficulty;
            if (d !== 1 && d !== 2 && d !== 3) ex.difficulty = 2;
          });
      });

    this.version(16)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
        chapters: 'id, topicId, orderIndex',
        requirements: 'id, chapterId, difficulty, mastery',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        subsubproblems: 'id, [subproblemId+label], subproblemId, label',
        attempts:
          'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
        attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
        attemptAiReviews: 'id, attemptId, result, createdAtMs',
        attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

        inkStrokes:
          'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',
        openAiPdfFileCache: 'pdfSha256, updatedAtMs',

        plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
        scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
      })
      .upgrade(async (tx) => {
        await tx
          .table('attemptAiReviews')
          .toCollection()
          .modify((row: {
            overallPercent?: unknown;
            score?: unknown;
            requirementPercents?: unknown;
            requirementUpdates?: unknown;
          }) => {
            if (!Array.isArray(row.requirementUpdates) && Array.isArray(row.requirementPercents)) {
              row.requirementUpdates = row.requirementPercents;
            }
            if ('requirementPercents' in row) delete row.requirementPercents;
            if ('overallPercent' in row) delete row.overallPercent;
            if ('score' in row) delete row.score;
          });
      });

    this.version(17)
      .stores({
        subjects: 'id, name',
        topics: 'id, subjectId, orderIndex',
        folders: 'id, topicId, parentFolderId, orderIndex',
        assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
        assetFiles: 'assetId',

        curriculumDocuments: 'id, subjectId, uploadedAtMs, status',
        chapters: 'id, topicId, orderIndex',
        requirements: 'id, chapterId, difficulty, mastery',

        studySessions: 'id, subjectId, topicId, startedAtMs, endedAtMs',
        exercises: 'id, assetId, status',
        problems: 'id, [exerciseId+idx], exerciseId, idx',
        subproblems: 'id, [problemId+label], problemId, label',
        subsubproblems: 'id, [subproblemId+label], subproblemId, label',
        attempts:
          'id, studySessionId, subproblemId, subsubproblemId, startedAtMs, endedAtMs, result, reviewStatus',
        attemptRequirementLinks: 'id, attemptId, requirementId, [attemptId+requirementId]',
        attemptAiReviews: 'id, attemptId, result, createdAtMs',
        attemptReviewJobs: 'id, attemptId, assetId, topicId, subjectId, status, requestedAtMs',

        inkStrokes:
          'id, [studySessionId+assetId], studySessionId, assetId, attemptId, createdAtMs, updatedAtMs',
        openAiPdfFileCache: 'pdfSha256, updatedAtMs',

        plannedItems: 'id, type, topicId, subjectId, startAtMs, durationMs, createdAtMs',
        scheduledReviews: 'id, subjectId, topicId, assetId, requirementId, dueAtMs, status',
      })
      .upgrade(async (tx) => {
        const reviews = await tx.table('attemptAiReviews').toArray();
        const reviewByAttemptId = new Map(
          reviews.map((row: { attemptId?: unknown; requirementUpdates?: unknown }) => [
            typeof row.attemptId === 'string' ? row.attemptId : '',
            Array.isArray(row.requirementUpdates) ? row.requirementUpdates : undefined,
          ]),
        );
        await tx
          .table('attempts')
          .toCollection()
          .modify((row: { id?: unknown; requirementUpdates?: unknown }) => {
            if (typeof row.id !== 'string') return;
            if (Array.isArray(row.requirementUpdates)) return;
            const requirementUpdates = reviewByAttemptId.get(row.id);
            if (Array.isArray(requirementUpdates)) row.requirementUpdates = requirementUpdates;
          });
      });
  }
}

export const db = new AbiDb();
