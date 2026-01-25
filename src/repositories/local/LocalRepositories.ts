import { db } from '../../db/db'
import type { Asset, Folder, Subject, Topic } from '../../domain/models'
import { newId } from '../../lib/id'
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
} from '../interfaces'

export class LocalSubjectRepository implements SubjectRepository {
  async list(): Promise<Subject[]> {
    return db.subjects.orderBy('createdAtMs').toArray()
  }

  async get(id: string): Promise<Subject | undefined> {
    return db.subjects.get(id)
  }

  async create(input: SubjectCreateInput): Promise<Subject> {
    const now = Date.now()
    const row: Subject = {
      id: newId(),
      name: input.name.trim(),
      color: input.color,
      createdAtMs: now,
    }
    await db.subjects.add(row)
    return row
  }

  async update(id: string, patch: SubjectUpdateInput): Promise<Subject> {
    const current = await db.subjects.get(id)
    if (!current) throw new Error('Subject not found')

    const next: Subject = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    }

    await db.subjects.put(next)
    return next
  }

  async delete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.subjects, db.topics, db.folders, db.assets, db.assetFiles],
      async () => {
        const topicIds = await db.topics.where('subjectId').equals(id).primaryKeys()
        const assetIds = await db.assets.where('subjectId').equals(id).primaryKeys()

        await db.assetFiles.bulkDelete(assetIds as string[])
        await db.assets.where('subjectId').equals(id).delete()
        await db.folders.where('topicId').anyOf(topicIds as string[]).delete()
        await db.topics.where('subjectId').equals(id).delete()
        await db.subjects.delete(id)
      },
    )
  }
}

export class LocalTopicRepository implements TopicRepository {
  async listBySubject(subjectId: string): Promise<Topic[]> {
    return db.topics.where('subjectId').equals(subjectId).sortBy('orderIndex')
  }

  async get(id: string): Promise<Topic | undefined> {
    return db.topics.get(id)
  }

  async create(input: TopicCreateInput): Promise<Topic> {
    const now = Date.now()
    const existing = await this.listBySubject(input.subjectId)
    const maxIdx = existing.reduce((m, t) => Math.max(m, t.orderIndex), -1)

    const row: Topic = {
      id: newId(),
      subjectId: input.subjectId,
      name: input.name.trim(),
      orderIndex: maxIdx + 1,
      createdAtMs: now,
    }
    await db.topics.add(row)
    return row
  }

  async update(id: string, patch: TopicUpdateInput): Promise<Topic> {
    const current = await db.topics.get(id)
    if (!current) throw new Error('Topic not found')

    const next: Topic = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.orderIndex !== undefined ? { orderIndex: patch.orderIndex } : {}),
    }

    await db.topics.put(next)
    return next
  }

  async delete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      db.topics,
      db.folders,
      db.assets,
      db.assetFiles,
      async () => {
        const assetIds = await db.assets.where('topicId').equals(id).primaryKeys()
        await db.assetFiles.bulkDelete(assetIds as string[])
        await db.assets.where('topicId').equals(id).delete()
        await db.folders.where('topicId').equals(id).delete()
        await db.topics.delete(id)
      },
    )
  }
}

export class LocalFolderRepository implements FolderRepository {
  async listByTopic(topicId: string): Promise<Folder[]> {
    return db.folders.where('topicId').equals(topicId).sortBy('orderIndex')
  }

  async get(id: string): Promise<Folder | undefined> {
    return db.folders.get(id)
  }

  async create(input: FolderCreateInput): Promise<Folder> {
    const now = Date.now()
    const existing = await this.listByTopic(input.topicId)
    const maxIdx = existing.reduce((m, f) => Math.max(m, f.orderIndex), -1)

    const row: Folder = {
      id: newId(),
      topicId: input.topicId,
      parentFolderId: input.parentFolderId,
      name: input.name.trim(),
      orderIndex: maxIdx + 1,
      createdAtMs: now,
    }
    await db.folders.add(row)
    return row
  }

  async update(id: string, patch: FolderUpdateInput): Promise<Folder> {
    const current = await db.folders.get(id)
    if (!current) throw new Error('Folder not found')

    const next: Folder = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.parentFolderId !== undefined
        ? { parentFolderId: patch.parentFolderId }
        : {}),
      ...(patch.orderIndex !== undefined ? { orderIndex: patch.orderIndex } : {}),
    }

    await db.folders.put(next)
    return next
  }

  async delete(id: string): Promise<void> {
    const current = await db.folders.get(id)
    if (!current) return

    await db.transaction('rw', [db.folders, db.assets], async () => {
      await db.assets.where('folderId').equals(id).modify({ folderId: undefined })

      await db.folders
        .where('parentFolderId')
        .equals(id)
        .modify({ parentFolderId: current.parentFolderId })
      await db.folders.delete(id)
    })
  }
}

export class LocalAssetRepository implements AssetRepository {
  async listByTopic(topicId: string): Promise<Asset[]> {
    const items = await db.assets.where('topicId').equals(topicId).sortBy('createdAtMs')
    return items.reverse()
  }

  async get(id: string): Promise<Asset | undefined> {
    return db.assets.get(id)
  }

  async create(input: AssetCreateInput): Promise<Asset> {
    const now = Date.now()
    const row: Asset = {
      id: newId(),
      subjectId: input.subjectId,
      topicId: input.topicId,
      folderId: input.folderId,
      type: input.type,
      title: input.title.trim(),
      createdAtMs: now,
    }
    await db.assets.add(row)
    return row
  }

  async update(id: string, patch: AssetUpdateInput): Promise<Asset> {
    const current = await db.assets.get(id)
    if (!current) throw new Error('Asset not found')

    const next: Asset = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
    }
    await db.assets.put(next)
    return next
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.assets, db.assetFiles, async () => {
      await db.assetFiles.delete(id)
      await db.assets.delete(id)
    })
  }
}

