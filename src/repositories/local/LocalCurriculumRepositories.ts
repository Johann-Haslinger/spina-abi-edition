import { db } from '../../db/db';
import type {
  Chapter,
  CurriculumDocument,
  Requirement,
  ScheduledReview,
} from '../../domain/models';
import { newId } from '../../lib/id';
import type {
  ChapterCreateInput,
  ChapterRepository,
  ChapterUpdateInput,
  CurriculumDocumentCreateInput,
  CurriculumDocumentRepository,
  CurriculumDocumentUpdateInput,
  RequirementCreateInput,
  RequirementRepository,
  RequirementUpdateInput,
  ScheduledReviewRepository,
} from '../interfaces';

export class LocalCurriculumDocumentRepository implements CurriculumDocumentRepository {
  async listBySubject(subjectId: string): Promise<CurriculumDocument[]> {
    return db.curriculumDocuments
      .where('subjectId')
      .equals(subjectId)
      .reverse()
      .sortBy('uploadedAtMs');
  }

  async create(input: CurriculumDocumentCreateInput): Promise<CurriculumDocument> {
    const row: CurriculumDocument = {
      id: newId(),
      subjectId: input.subjectId,
      sourceName: input.sourceName.trim(),
      uploadedAtMs: Date.now(),
      status: input.status,
      outlineJson: input.outlineJson,
      error: input.error,
    };
    await db.curriculumDocuments.add(row);
    return row;
  }

  async update(id: string, patch: CurriculumDocumentUpdateInput): Promise<CurriculumDocument> {
    const current = await db.curriculumDocuments.get(id);
    if (!current) throw new Error('Curriculum document not found');
    const next: CurriculumDocument = { ...current, ...patch };
    await db.curriculumDocuments.put(next);
    return next;
  }

  async deleteBySubject(subjectId: string): Promise<void> {
    await db.curriculumDocuments.where('subjectId').equals(subjectId).delete();
  }
}

export class LocalChapterRepository implements ChapterRepository {
  async listByTopic(topicId: string): Promise<Chapter[]> {
    return db.chapters.where('topicId').equals(topicId).sortBy('orderIndex');
  }

  async create(input: ChapterCreateInput): Promise<Chapter> {
    const row: Chapter = {
      id: newId(),
      topicId: input.topicId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      orderIndex: input.orderIndex,
      explanationAssetId: input.explanationAssetId,
    };
    await db.chapters.add(row);
    return row;
  }

  async update(id: string, patch: ChapterUpdateInput): Promise<Chapter> {
    const current = await db.chapters.get(id);
    if (!current) throw new Error('Chapter not found');
    const next: Chapter = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || undefined }
        : {}),
      ...(patch.orderIndex !== undefined ? { orderIndex: patch.orderIndex } : {}),
      ...(patch.explanationAssetId !== undefined
        ? { explanationAssetId: patch.explanationAssetId }
        : {}),
    };
    await db.chapters.put(next);
    return next;
  }

  async deleteByTopic(topicId: string): Promise<void> {
    await db.chapters.where('topicId').equals(topicId).delete();
  }
}

export class LocalRequirementRepository implements RequirementRepository {
  async get(id: string): Promise<Requirement | undefined> {
    return db.requirements.get(id);
  }

  async listByChapterIds(chapterIds: string[]): Promise<Requirement[]> {
    if (chapterIds.length === 0) return [];
    return db.requirements.where('chapterId').anyOf(chapterIds).toArray();
  }

  async create(input: RequirementCreateInput): Promise<Requirement> {
    const row: Requirement = {
      id: newId(),
      chapterId: input.chapterId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      difficulty: input.difficulty,
      mastery: clampMastery(input.mastery ?? 0),
    };
    await db.requirements.add(row);
    return row;
  }

  async update(id: string, patch: RequirementUpdateInput): Promise<Requirement> {
    const current = await db.requirements.get(id);
    if (!current) throw new Error('Requirement not found');
    const next: Requirement = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || undefined }
        : {}),
      ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
      ...(patch.mastery !== undefined ? { mastery: clampMastery(patch.mastery) } : {}),
    };
    await db.requirements.put(next);
    return next;
  }

  async deleteByChapterIds(chapterIds: string[]): Promise<void> {
    if (chapterIds.length === 0) return;
    await db.requirements.where('chapterId').anyOf(chapterIds).delete();
  }
}

export class LocalScheduledReviewRepository implements ScheduledReviewRepository {
  async listBySubject(subjectId: string): Promise<ScheduledReview[]> {
    return db.scheduledReviews.where('subjectId').equals(subjectId).sortBy('dueAtMs');
  }

  async listDueBySubject(subjectId: string, nowMs: number): Promise<ScheduledReview[]> {
    const rows = await db.scheduledReviews.where('subjectId').equals(subjectId).toArray();
    return rows
      .filter((row) => row.status === 'pending' && row.dueAtMs <= nowMs)
      .sort((a, b) => a.dueAtMs - b.dueAtMs);
  }

  async upsert(
    input: Omit<ScheduledReview, 'id' | 'createdAtMs'> & { id?: string },
  ): Promise<ScheduledReview> {
    const row: ScheduledReview = {
      id: input.id ?? newId(),
      subjectId: input.subjectId,
      topicId: input.topicId,
      assetId: input.assetId,
      requirementId: input.requirementId,
      attemptId: input.attemptId,
      dueAtMs: input.dueAtMs,
      status: input.status,
      createdAtMs: Date.now(),
      completedAtMs: input.completedAtMs,
    };
    await db.scheduledReviews.put(row);
    return row;
  }

  async markCompleted(id: string, completedAtMs: number): Promise<void> {
    await db.scheduledReviews.update(id, { status: 'completed', completedAtMs });
  }
}

function clampMastery(mastery: number) {
  return Math.max(0, Math.min(1, Number.isFinite(mastery) ? mastery : 0));
}
