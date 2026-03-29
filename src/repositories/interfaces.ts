import type {
  Asset,
  AssetFile,
  AssetType,
  Chapter,
  CurriculumDocument,
  Folder,
  LearnPathMode,
  LearnPathProgress,
  Requirement,
  ScheduledReview,
  Subject,
  SubjectColorAssignment,
  Topic,
} from '../domain/models';

export type SubjectCreateInput = {
  name: string;
  color: SubjectColorAssignment;
  iconEmoji?: string;
};

export type SubjectUpdateInput = {
  name?: string;
  color?: SubjectColorAssignment;
  iconEmoji?: string | undefined;
};

export type TopicCreateInput = {
  subjectId: string;
  name: string;
  iconEmoji?: string;
};

export type TopicUpdateInput = {
  name?: string;
  iconEmoji?: string | undefined;
};

export type FolderCreateInput = {
  topicId: string;
  parentFolderId?: string;
  name: string;
  iconEmoji?: string;
};

export type FolderUpdateInput = {
  name?: string;
  parentFolderId?: string | undefined;
  orderIndex?: number;
  iconEmoji?: string | undefined;
};

export type AssetCreateInput = {
  subjectId: string;
  topicId: string;
  folderId?: string;
  type: AssetType;
  title: string;
};

export type AssetUpdateInput = {
  title?: string;
  folderId?: string | undefined;
  type?: AssetType;
};

export type CurriculumDocumentCreateInput = {
  subjectId: string;
  sourceName: string;
  status: CurriculumDocument['status'];
  outlineJson?: string;
  error?: string;
};

export type CurriculumDocumentUpdateInput = Partial<
  Pick<CurriculumDocument, 'status' | 'outlineJson' | 'error'>
>;

export type ChapterCreateInput = {
  topicId: string;
  name: string;
  description?: string;
  orderIndex: number;
  explanationAssetId?: string;
};

export type ChapterUpdateInput = Partial<
  Pick<Chapter, 'name' | 'description' | 'orderIndex' | 'explanationAssetId'>
>;

export type RequirementCreateInput = {
  chapterId: string;
  name: string;
  description?: string;
  difficulty: Requirement['difficulty'];
  mastery?: number;
};

export type RequirementUpdateInput = Partial<
  Pick<Requirement, 'name' | 'description' | 'difficulty' | 'mastery'>
>;

export type LearnPathProgressUpsertInput = Omit<
  LearnPathProgress,
  'id' | 'startedAtMs' | 'updatedAtMs'
> & {
  id?: string;
  startedAtMs?: number;
  updatedAtMs?: number;
};

export interface SubjectRepository {
  list(): Promise<Subject[]>;
  get(id: string): Promise<Subject | undefined>;
  create(input: SubjectCreateInput): Promise<Subject>;
  update(id: string, patch: SubjectUpdateInput): Promise<Subject>;
  delete(id: string): Promise<void>;
}

export interface TopicRepository {
  listBySubject(subjectId: string): Promise<Topic[]>;
  get(id: string): Promise<Topic | undefined>;
  create(input: TopicCreateInput): Promise<Topic>;
  update(id: string, patch: TopicUpdateInput): Promise<Topic>;
  delete(id: string): Promise<void>;
}

export interface FolderRepository {
  listByTopic(topicId: string): Promise<Folder[]>;
  get(id: string): Promise<Folder | undefined>;
  create(input: FolderCreateInput): Promise<Folder>;
  update(id: string, patch: FolderUpdateInput): Promise<Folder>;
  delete(id: string): Promise<void>;
}

export interface AssetRepository {
  listByTopic(topicId: string): Promise<Asset[]>;
  get(id: string): Promise<Asset | undefined>;
  create(input: AssetCreateInput): Promise<Asset>;
  update(id: string, patch: AssetUpdateInput): Promise<Asset>;
  delete(id: string): Promise<void>;
}

export interface AssetFileStore {
  put(assetId: string, file: File): Promise<AssetFile>;
  get(assetId: string): Promise<AssetFile | undefined>;
  delete(assetId: string): Promise<void>;
}

export interface CurriculumDocumentRepository {
  listBySubject(subjectId: string): Promise<CurriculumDocument[]>;
  create(input: CurriculumDocumentCreateInput): Promise<CurriculumDocument>;
  update(id: string, patch: CurriculumDocumentUpdateInput): Promise<CurriculumDocument>;
  deleteBySubject(subjectId: string): Promise<void>;
}

export interface ChapterRepository {
  listByTopic(topicId: string): Promise<Chapter[]>;
  create(input: ChapterCreateInput): Promise<Chapter>;
  update(id: string, patch: ChapterUpdateInput): Promise<Chapter>;
  deleteByTopic(topicId: string): Promise<void>;
}

export interface RequirementRepository {
  get(id: string): Promise<Requirement | undefined>;
  listByChapterIds(chapterIds: string[]): Promise<Requirement[]>;
  create(input: RequirementCreateInput): Promise<Requirement>;
  update(id: string, patch: RequirementUpdateInput): Promise<Requirement>;
  deleteByChapterIds(chapterIds: string[]): Promise<void>;
}

export interface LearnPathProgressRepository {
  get(id: string): Promise<LearnPathProgress | undefined>;
  listByTopic(topicId: string): Promise<LearnPathProgress[]>;
  getByTopicRequirementMode(
    topicId: string,
    requirementId: string,
    mode: LearnPathMode,
  ): Promise<LearnPathProgress | undefined>;
  upsert(input: LearnPathProgressUpsertInput): Promise<LearnPathProgress>;
  deleteByTopic(topicId: string): Promise<void>;
}

export interface ScheduledReviewRepository {
  listBySubject(subjectId: string): Promise<ScheduledReview[]>;
  listDueBySubject(subjectId: string, nowMs: number): Promise<ScheduledReview[]>;
  upsert(input: Omit<ScheduledReview, 'id' | 'createdAtMs'> & { id?: string }): Promise<ScheduledReview>;
  markCompleted(id: string, completedAtMs: number): Promise<void>;
}
