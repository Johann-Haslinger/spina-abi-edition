import type { Asset, AssetFile, AssetType, Folder, Subject, Topic } from '../domain/models'

export type SubjectCreateInput = {
  name: string
  color: string
  iconEmoji?: string
}

export type SubjectUpdateInput = {
  name?: string
  color?: string
  iconEmoji?: string | undefined
}

export type TopicCreateInput = {
  subjectId: string
  name: string
  iconEmoji?: string
}

export type TopicUpdateInput = {
  name?: string
  orderIndex?: number
  iconEmoji?: string | undefined
}

export type FolderCreateInput = {
  topicId: string
  parentFolderId?: string
  name: string
  iconEmoji?: string
}

export type FolderUpdateInput = {
  name?: string
  parentFolderId?: string | undefined
  orderIndex?: number
  iconEmoji?: string | undefined
}

export type AssetCreateInput = {
  subjectId: string
  topicId: string
  folderId?: string
  type: AssetType
  title: string
}

export type AssetUpdateInput = {
  title?: string
  folderId?: string | undefined
  type?: AssetType
}

export interface SubjectRepository {
  list(): Promise<Subject[]>
  get(id: string): Promise<Subject | undefined>
  create(input: SubjectCreateInput): Promise<Subject>
  update(id: string, patch: SubjectUpdateInput): Promise<Subject>
  delete(id: string): Promise<void>
}

export interface TopicRepository {
  listBySubject(subjectId: string): Promise<Topic[]>
  get(id: string): Promise<Topic | undefined>
  create(input: TopicCreateInput): Promise<Topic>
  update(id: string, patch: TopicUpdateInput): Promise<Topic>
  delete(id: string): Promise<void>
}

export interface FolderRepository {
  listByTopic(topicId: string): Promise<Folder[]>
  get(id: string): Promise<Folder | undefined>
  create(input: FolderCreateInput): Promise<Folder>
  update(id: string, patch: FolderUpdateInput): Promise<Folder>
  delete(id: string): Promise<void>
}

export interface AssetRepository {
  listByTopic(topicId: string): Promise<Asset[]>
  get(id: string): Promise<Asset | undefined>
  create(input: AssetCreateInput): Promise<Asset>
  update(id: string, patch: AssetUpdateInput): Promise<Asset>
  delete(id: string): Promise<void>
}

export interface AssetFileStore {
  put(assetId: string, file: File): Promise<AssetFile>
  get(assetId: string): Promise<AssetFile | undefined>
  delete(assetId: string): Promise<void>
}

