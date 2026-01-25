export type Id = string

export type AssetType = 'exercise' | 'note' | 'cheatsheet' | 'file'

export type Subject = {
  id: Id
  name: string
  color: string
  iconEmoji?: string
}

export type Topic = {
  id: Id
  subjectId: Id
  name: string
  orderIndex: number
  iconEmoji?: string
}

export type Folder = {
  id: Id
  topicId: Id
  parentFolderId?: Id
  name: string
  orderIndex: number
  iconEmoji?: string
}

export type Asset = {
  id: Id
  subjectId: Id
  topicId: Id
  folderId?: Id
  type: AssetType
  title: string
  createdAtMs: number
}

export type AssetFile = {
  assetId: Id
  mimeType: string
  originalName: string
  sizeBytes: number
  blob: Blob
}

