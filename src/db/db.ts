import Dexie, { type Table } from 'dexie'
import type { Asset, AssetFile, Folder, Subject, Topic } from '../domain/models'

export class AbiDb extends Dexie {
  subjects!: Table<Subject, string>
  topics!: Table<Topic, string>
  folders!: Table<Folder, string>
  assets!: Table<Asset, string>
  assetFiles!: Table<AssetFile, string> // pk: assetId

  constructor() {
    super('abi-lernapp')

    this.version(1).stores({
      subjects: 'id, createdAtMs',
      topics: 'id, subjectId, orderIndex, createdAtMs',
      folders: 'id, topicId, parentFolderId, orderIndex, createdAtMs',
      assets: 'id, subjectId, topicId, folderId, type, createdAtMs',
      assetFiles: 'assetId',
    })
  }
}

export const db = new AbiDb()

