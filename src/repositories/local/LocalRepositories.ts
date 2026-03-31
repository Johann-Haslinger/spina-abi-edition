import { db } from '../../db/db';
import type { Asset, Folder, Subject, Topic } from '../../domain/models';
import { newId } from '../../lib/id';
import type {
  AssetCreateInput,
  AssetRepository,
  AssetUpdateInput,
  FolderCreateInput,
  FolderRepository,
  FolderUpdateInput,
  SubjectCreateInput,
  SubjectRepository,
  SubjectUpdateInput,
  TopicCreateInput,
  TopicRepository,
  TopicUpdateInput,
} from '../interfaces';

export class LocalSubjectRepository implements SubjectRepository {
  async list(): Promise<Subject[]> {
    try {
      return await db.subjects.orderBy('name').toArray();
    } catch {
      const rows = await db.subjects.toArray();
      return rows
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
  }

  async get(id: string): Promise<Subject | undefined> {
    return db.subjects.get(id);
  }

  async create(input: SubjectCreateInput): Promise<Subject> {
    const row: Subject = {
      id: newId(),
      name: input.name.trim(),
      color: input.color,
      iconEmoji: input.iconEmoji?.trim() || undefined,
    };
    await db.subjects.add(row);
    return row;
  }

  async update(id: string, patch: SubjectUpdateInput): Promise<Subject> {
    const current = await db.subjects.get(id);
    if (!current) throw new Error('Subject not found');

    const next: Subject = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.iconEmoji !== undefined ? { iconEmoji: patch.iconEmoji?.trim() || undefined } : {}),
    };

    await db.subjects.put(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.subjects,
        db.topics,
        db.folders,
        db.assets,
        db.assetFiles,
        db.exercises,
        db.problems,
        db.subproblems,
        db.subsubproblems,
        db.attempts,
        db.attemptRequirementLinks,
        db.attemptAiReviews,
        db.attemptReviewJobs,
        db.inkStrokes,
        db.curriculumDocuments,
        db.chapters,
        db.requirements,
        db.learnPathProgress,
        db.learnPathSessionRequirements,
        db.scheduledReviews,
      ],
      async () => {
        const topicIds = await db.topics.where('subjectId').equals(id).primaryKeys();
        const assetIds = await db.assets.where('subjectId').equals(id).primaryKeys();
        const exerciseIds =
          assetIds.length > 0
            ? await db.exercises.where('assetId').anyOf(assetIds as string[]).primaryKeys()
            : [];
        const problemIds =
          exerciseIds.length > 0
            ? await db.problems.where('exerciseId').anyOf(exerciseIds as string[]).primaryKeys()
            : [];
        const subproblemIds =
          problemIds.length > 0
            ? await db.subproblems.where('problemId').anyOf(problemIds as string[]).primaryKeys()
            : [];
        const attemptIds =
          subproblemIds.length > 0
            ? await db.attempts.where('subproblemId').anyOf(subproblemIds as string[]).primaryKeys()
            : [];
        const chapterIds =
          topicIds.length > 0 ? await db.chapters.where('topicId').anyOf(topicIds as string[]).primaryKeys() : [];
        const requirementIds =
          chapterIds.length > 0
            ? await db.requirements.where('chapterId').anyOf(chapterIds as string[]).primaryKeys()
            : [];

        await db.curriculumDocuments.where('subjectId').equals(id).delete();
        await db.scheduledReviews.where('subjectId').equals(id).delete();
        if (attemptIds.length) {
          await db.attemptRequirementLinks.where('attemptId').anyOf(attemptIds as string[]).delete();
          await db.attemptAiReviews
            .filter((row) => attemptIds.includes(row.attemptId))
            .delete();
          await db.attemptReviewJobs
            .filter((row) => attemptIds.includes(row.attemptId))
            .delete();
          await db.attempts.bulkDelete(attemptIds as string[]);
        }
        if (subproblemIds.length) {
          await db.subsubproblems.where('subproblemId').anyOf(subproblemIds as string[]).delete();
          await db.subproblems.bulkDelete(subproblemIds as string[]);
        }
        if (problemIds.length) await db.problems.bulkDelete(problemIds as string[]);
        if (exerciseIds.length) await db.exercises.bulkDelete(exerciseIds as string[]);
        if (assetIds.length) {
          await db.inkStrokes.where('assetId').anyOf(assetIds as string[]).delete();
        }
        if (requirementIds.length) {
          await db.requirements.bulkDelete(requirementIds as string[]);
        }
        if (topicIds.length) {
          await db.learnPathProgress.where('topicId').anyOf(topicIds as string[]).delete();
          await db.learnPathSessionRequirements.where('topicId').anyOf(topicIds as string[]).delete();
        }
        if (chapterIds.length) await db.chapters.bulkDelete(chapterIds as string[]);
        await db.assetFiles.bulkDelete(assetIds as string[]);
        await db.assets.where('subjectId').equals(id).delete();
        await db.folders
          .where('topicId')
          .anyOf(topicIds as string[])
          .delete();
        await db.topics.where('subjectId').equals(id).delete();
        await db.subjects.delete(id);
      },
    );
  }
}

export class LocalTopicRepository implements TopicRepository {
  async listBySubject(subjectId: string): Promise<Topic[]> {
    const rows = await db.topics.where('subjectId').equals(subjectId).toArray();
    return rows
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  async get(id: string): Promise<Topic | undefined> {
    return db.topics.get(id);
  }

  async create(input: TopicCreateInput): Promise<Topic> {
    const row: Topic = {
      id: newId(),
      subjectId: input.subjectId,
      name: input.name.trim(),
      iconEmoji: input.iconEmoji?.trim() || undefined,
    };
    await db.topics.add(row);
    return row;
  }

  async update(id: string, patch: TopicUpdateInput): Promise<Topic> {
    const current = await db.topics.get(id);
    if (!current) throw new Error('Topic not found');

    const next: Topic = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.iconEmoji !== undefined ? { iconEmoji: patch.iconEmoji?.trim() || undefined } : {}),
    };

    await db.topics.put(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.topics,
        db.folders,
        db.assets,
        db.assetFiles,
        db.exercises,
        db.problems,
        db.subproblems,
        db.subsubproblems,
        db.attempts,
        db.attemptRequirementLinks,
        db.attemptAiReviews,
        db.attemptReviewJobs,
        db.inkStrokes,
        db.chapters,
        db.requirements,
        db.learnPathProgress,
        db.learnPathSessionRequirements,
        db.scheduledReviews,
      ],
      async () => {
      const assetIds = await db.assets.where('topicId').equals(id).primaryKeys();
      const exerciseIds =
        assetIds.length > 0
          ? await db.exercises.where('assetId').anyOf(assetIds as string[]).primaryKeys()
          : [];
      const problemIds =
        exerciseIds.length > 0
          ? await db.problems.where('exerciseId').anyOf(exerciseIds as string[]).primaryKeys()
          : [];
      const subproblemIds =
        problemIds.length > 0
          ? await db.subproblems.where('problemId').anyOf(problemIds as string[]).primaryKeys()
          : [];
      const attemptIds =
        subproblemIds.length > 0
          ? await db.attempts.where('subproblemId').anyOf(subproblemIds as string[]).primaryKeys()
          : [];
      const chapterIds = await db.chapters.where('topicId').equals(id).primaryKeys();
      const requirementIds =
        chapterIds.length > 0
          ? await db.requirements.where('chapterId').anyOf(chapterIds as string[]).primaryKeys()
          : [];
      if (attemptIds.length) {
        await db.attemptRequirementLinks.where('attemptId').anyOf(attemptIds as string[]).delete();
        await db.attemptAiReviews
          .filter((row) => attemptIds.includes(row.attemptId))
          .delete();
        await db.attemptReviewJobs
          .filter((row) => attemptIds.includes(row.attemptId))
          .delete();
        await db.attempts.bulkDelete(attemptIds as string[]);
      }
      if (subproblemIds.length) {
        await db.subsubproblems.where('subproblemId').anyOf(subproblemIds as string[]).delete();
        await db.subproblems.bulkDelete(subproblemIds as string[]);
      }
      if (problemIds.length) await db.problems.bulkDelete(problemIds as string[]);
      if (exerciseIds.length) await db.exercises.bulkDelete(exerciseIds as string[]);
      await db.assetFiles.bulkDelete(assetIds as string[]);
      if (assetIds.length) await db.inkStrokes.where('assetId').anyOf(assetIds as string[]).delete();
      await db.assets.where('topicId').equals(id).delete();
      await db.learnPathProgress.where('topicId').equals(id).delete();
      await db.learnPathSessionRequirements.where('topicId').equals(id).delete();
      await db.scheduledReviews.where('topicId').equals(id).delete();
      if (requirementIds.length) {
        await db.requirements.bulkDelete(requirementIds as string[]);
      }
      if (chapterIds.length) await db.chapters.bulkDelete(chapterIds as string[]);
      await db.folders.where('topicId').equals(id).delete();
      await db.topics.delete(id);
      },
    );
  }
}

export class LocalFolderRepository implements FolderRepository {
  async listByTopic(topicId: string): Promise<Folder[]> {
    return db.folders.where('topicId').equals(topicId).sortBy('orderIndex');
  }

  async get(id: string): Promise<Folder | undefined> {
    return db.folders.get(id);
  }

  async create(input: FolderCreateInput): Promise<Folder> {
    const existing = await this.listByTopic(input.topicId);
    const maxIdx = existing.reduce((m, f) => Math.max(m, f.orderIndex), -1);

    const row: Folder = {
      id: newId(),
      topicId: input.topicId,
      parentFolderId: input.parentFolderId,
      name: input.name.trim(),
      orderIndex: maxIdx + 1,
      iconEmoji: input.iconEmoji?.trim() || undefined,
    };
    await db.folders.add(row);
    return row;
  }

  async update(id: string, patch: FolderUpdateInput): Promise<Folder> {
    const current = await db.folders.get(id);
    if (!current) throw new Error('Folder not found');

    const next: Folder = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.parentFolderId !== undefined ? { parentFolderId: patch.parentFolderId } : {}),
      ...(patch.orderIndex !== undefined ? { orderIndex: patch.orderIndex } : {}),
      ...(patch.iconEmoji !== undefined ? { iconEmoji: patch.iconEmoji?.trim() || undefined } : {}),
    };

    await db.folders.put(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    const current = await db.folders.get(id);
    if (!current) return;

    await db.transaction('rw', [db.folders, db.assets], async () => {
      await db.assets.where('folderId').equals(id).modify({ folderId: undefined });

      await db.folders
        .where('parentFolderId')
        .equals(id)
        .modify({ parentFolderId: current.parentFolderId });
      await db.folders.delete(id);
    });
  }
}

export class LocalAssetRepository implements AssetRepository {
  async listByTopic(topicId: string): Promise<Asset[]> {
    const items = await db.assets.where('topicId').equals(topicId).sortBy('createdAtMs');
    return items.reverse();
  }

  async get(id: string): Promise<Asset | undefined> {
    return db.assets.get(id);
  }

  async create(input: AssetCreateInput): Promise<Asset> {
    const now = Date.now();
    const row: Asset = {
      id: newId(),
      subjectId: input.subjectId,
      topicId: input.topicId,
      folderId: input.folderId,
      type: input.type,
      title: input.title.trim(),
      createdAtMs: now,
    };
    await db.assets.add(row);
    return row;
  }

  async update(id: string, patch: AssetUpdateInput): Promise<Asset> {
    const current = await db.assets.get(id);
    if (!current) throw new Error('Asset not found');

    const next: Asset = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
    };
    await db.assets.put(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.assets, db.assetFiles, async () => {
      await db.assetFiles.delete(id);
      await db.assets.delete(id);
    });
  }
}
