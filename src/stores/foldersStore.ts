import { create } from 'zustand'
import type { Folder } from '../domain/models'
import { folderRepo } from '../repositories'

type FoldersState = {
  foldersByTopic: Record<string, Folder[]>
  loadingByTopic: Record<string, boolean>
  errorByTopic: Record<string, string | undefined>
  refreshByTopic: (topicId: string) => Promise<void>
  createFolder: (input: {
    topicId: string
    parentFolderId?: string
    name: string
  }) => Promise<Folder>
  renameFolder: (id: string, topicId: string, name: string) => Promise<Folder>
  deleteFolder: (id: string, topicId: string) => Promise<void>
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  foldersByTopic: {},
  loadingByTopic: {},
  errorByTopic: {},

  refreshByTopic: async (topicId) => {
    set((s) => ({
      loadingByTopic: { ...s.loadingByTopic, [topicId]: true },
      errorByTopic: { ...s.errorByTopic, [topicId]: undefined },
    }))

    try {
      const folders = await folderRepo.listByTopic(topicId)
      set((s) => ({
        foldersByTopic: { ...s.foldersByTopic, [topicId]: folders },
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

  createFolder: async ({ topicId, parentFolderId, name }) => {
    const created = await folderRepo.create({ topicId, parentFolderId, name })
    await get().refreshByTopic(topicId)
    return created
  },

  renameFolder: async (id, topicId, name) => {
    const updated = await folderRepo.update(id, { name })
    await get().refreshByTopic(topicId)
    return updated
  },

  deleteFolder: async (id, topicId) => {
    await folderRepo.delete(id)
    await get().refreshByTopic(topicId)
  },
}))

