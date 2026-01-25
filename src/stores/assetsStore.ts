import { create } from 'zustand'
import type { Asset, AssetFile, AssetType } from '../domain/models'
import { assetFileStore, assetRepo } from '../repositories'

type AssetsState = {
  assetsByTopic: Record<string, Asset[]>
  loadingByTopic: Record<string, boolean>
  errorByTopic: Record<string, string | undefined>
  refreshByTopic: (topicId: string) => Promise<void>
  createWithFile: (input: {
    subjectId: string
    topicId: string
    folderId?: string
    type: AssetType
    title: string
    file: File
  }) => Promise<Asset>
  updateAsset: (
    id: string,
    topicId: string,
    patch: { title?: string; folderId?: string | undefined; type?: AssetType },
  ) => Promise<Asset>
  deleteAsset: (id: string, topicId: string) => Promise<void>
  getFile: (assetId: string) => Promise<AssetFile | undefined>
}

export const useAssetsStore = create<AssetsState>((set, get) => ({
  assetsByTopic: {},
  loadingByTopic: {},
  errorByTopic: {},

  refreshByTopic: async (topicId) => {
    set((s) => ({
      loadingByTopic: { ...s.loadingByTopic, [topicId]: true },
      errorByTopic: { ...s.errorByTopic, [topicId]: undefined },
    }))

    try {
      const assets = await assetRepo.listByTopic(topicId)
      set((s) => ({
        assetsByTopic: { ...s.assetsByTopic, [topicId]: assets },
        loadingByTopic: { ...s.loadingByTopic, [topicId]: false },
      }))
    } catch (e) {
      set((s) => ({
        loadingByTopic: { ...s.loadingByTopic, [topicId]: false },
        errorByTopic: {
          ...s.errorByTopic,
          [topicId]: e instanceof Error ? e.message : 'Fehler beim Laden',
        },
      }))
    }
  },

  createWithFile: async ({ file, ...input }) => {
    const created = await assetRepo.create(input)
    try {
      await assetFileStore.put(created.id, file)
    } catch (e) {
      await assetRepo.delete(created.id)
      throw e
    }

    await get().refreshByTopic(input.topicId)
    return created
  },

  updateAsset: async (id, topicId, patch) => {
    const updated = await assetRepo.update(id, patch)
    await get().refreshByTopic(topicId)
    return updated
  },

  deleteAsset: async (id, topicId) => {
    await assetRepo.delete(id)
    await assetFileStore.delete(id)
    await get().refreshByTopic(topicId)
  },

  getFile: async (assetId) => assetFileStore.get(assetId),
}))

