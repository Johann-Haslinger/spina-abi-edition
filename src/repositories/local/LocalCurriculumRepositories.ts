import { db } from '../../db/db';
import type {
  Chapter,
  CurriculumDocument,
  Flashcard,
  LearnPathProgress,
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
  FlashcardRepository,
  FlashcardUpsertInput,
  LearnPathProgressRepository,
  LearnPathProgressUpsertInput,
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

export class LocalLearnPathProgressRepository implements LearnPathProgressRepository {
  async get(id: string): Promise<LearnPathProgress | undefined> {
    return db.learnPathProgress.get(id);
  }

  async listByTopic(topicId: string): Promise<LearnPathProgress[]> {
    return db.learnPathProgress
      .where('topicId')
      .equals(topicId)
      .reverse()
      .sortBy('updatedAtMs');
  }

  async getByTopicRequirementMode(
    topicId: string,
    requirementId: string,
    mode: LearnPathProgress['mode'],
  ): Promise<LearnPathProgress | undefined> {
    return db.learnPathProgress
      .where('[topicId+requirementId+mode]')
      .equals([topicId, requirementId, mode])
      .first();
  }

  async upsert(input: LearnPathProgressUpsertInput): Promise<LearnPathProgress> {
    const now = Date.now();
    const row: LearnPathProgress = {
      id: input.id ?? `${input.topicId}:${input.requirementId}:${input.mode}`,
      topicId: input.topicId,
      chapterId: input.chapterId,
      requirementId: input.requirementId,
      mode: input.mode,
      status: input.status,
      startedAtMs: input.startedAtMs ?? now,
      updatedAtMs: input.updatedAtMs ?? now,
      completedAtMs: input.completedAtMs,
      currentChapterIndex: input.currentChapterIndex,
      currentRequirementIndex: input.currentRequirementIndex,
      lastStepId: input.lastStepId,
      lastPlanJson: input.lastPlanJson,
      lastMessagesJson: input.lastMessagesJson,
    };
    await db.learnPathProgress.put(row);
    return row;
  }

  async deleteByTopic(topicId: string): Promise<void> {
    await db.learnPathProgress.where('topicId').equals(topicId).delete();
  }
}

export class LocalFlashcardRepository implements FlashcardRepository {
  async get(id: string): Promise<Flashcard | undefined> {
    return db.flashcards.get(id);
  }

  async listByTopic(topicId: string): Promise<Flashcard[]> {
    return db.flashcards
      .where('topicId')
      .equals(topicId)
      .reverse()
      .sortBy('updatedAtMs');
  }

  async listDueByTopic(topicId: string, nowMs: number): Promise<Flashcard[]> {
    const rows = await db.flashcards.where('topicId').equals(topicId).toArray();
    return rows
      .filter((row) => row.state === 'active' && row.dueAtMs <= nowMs)
      .sort((a, b) => a.dueAtMs - b.dueAtMs || a.updatedAtMs - b.updatedAtMs);
  }

  async upsert(input: FlashcardUpsertInput): Promise<Flashcard> {
    const now = input.updatedAtMs ?? Date.now();
    const current = input.id ? await db.flashcards.get(input.id) : undefined;
    const row: Flashcard = {
      ...(current ?? {}),
      ...input,
      id: current?.id ?? input.id ?? newId(),
      front: input.front.trim(),
      back: input.back.trim(),
      source: input.source ?? current?.source ?? 'manual',
      state: input.state ?? current?.state ?? 'active',
      dueAtMs: input.dueAtMs,
      createdAtMs: current?.createdAtMs ?? input.createdAtMs ?? now,
      updatedAtMs: now,
      intervalDays: clampIntervalDays(input.intervalDays),
      successStreak: Math.max(0, input.successStreak),
      reviewCount: Math.max(0, input.reviewCount),
    };
    await db.flashcards.put(row);
    return row;
  }

  async bulkUpsert(inputs: FlashcardUpsertInput[]): Promise<Flashcard[]> {
    return Promise.all(inputs.map((input) => this.upsert(input)));
  }

  async delete(id: string): Promise<void> {
    await db.flashcards.delete(id);
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

function clampIntervalDays(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(365, value));
}
