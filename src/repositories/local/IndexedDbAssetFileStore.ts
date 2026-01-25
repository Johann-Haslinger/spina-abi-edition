import { db } from '../../db/db'
import type { AssetFile } from '../../domain/models'

export class IndexedDbAssetFileStore {
  async put(assetId: string, file: File): Promise<AssetFile> {
    const row: AssetFile = {
      assetId,
      mimeType: file.type || 'application/octet-stream',
      originalName: file.name,
      sizeBytes: file.size,
      blob: file,
    }

    await db.assetFiles.put(row)
    return row
  }

  async get(assetId: string): Promise<AssetFile | undefined> {
    return db.assetFiles.get(assetId)
  }

  async delete(assetId: string): Promise<void> {
    await db.assetFiles.delete(assetId)
  }
}

