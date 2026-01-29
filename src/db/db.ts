import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  AssetFile,
  Attempt,
  Exercise,
  Folder,
  Problem,
  StudySession,
  Subject,
  Subproblem,
  Topic,
} from '../domain/models';
import { SubjectColorId } from '../domain/models';

export class AbiDb extends Dexie {
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  folders!: Table<Folder, string>;
  assets!: Table<Asset, string>;
  assetFiles!: Table<AssetFile, string>;

  studySessions!: Table<StudySession, string>;
  exercises!: Table<Exercise, string>;
  problems!: Table<Problem, string>;
  subproblems!: Table<Subproblem, string>;
  attempts!: Table<Attempt, string>;

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
          .modify((s: any) => {
            if (s?.color && typeof s.color === 'object' && 'toneOrder' in s.color) {
              delete s.color.toneOrder;
            }
          });
      });
  }
}

export const db = new AbiDb();
