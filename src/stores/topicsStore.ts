import { create } from 'zustand'
import type { Topic } from '../domain/models'
import { topicRepo } from '../repositories'

type TopicsState = {
  topicsBySubject: Record<string, Topic[]>
  loadingBySubject: Record<string, boolean>
  errorBySubject: Record<string, string | undefined>
  refreshBySubject: (subjectId: string) => Promise<void>
  createTopic: (input: { subjectId: string; name: string }) => Promise<Topic>
  renameTopic: (id: string, subjectId: string, name: string) => Promise<Topic>
  deleteTopic: (id: string, subjectId: string) => Promise<void>
  moveTopic: (
    subjectId: string,
    topicId: string,
    direction: 'up' | 'down',
  ) => Promise<void>
}

export const useTopicsStore = create<TopicsState>((set, get) => ({
  topicsBySubject: {},
  loadingBySubject: {},
  errorBySubject: {},

  refreshBySubject: async (subjectId) => {
    set((s) => ({
      loadingBySubject: { ...s.loadingBySubject, [subjectId]: true },
      errorBySubject: { ...s.errorBySubject, [subjectId]: undefined },
    }))

    try {
      const topics = await topicRepo.listBySubject(subjectId)
      set((s) => ({
        topicsBySubject: { ...s.topicsBySubject, [subjectId]: topics },
        loadingBySubject: { ...s.loadingBySubject, [subjectId]: false },
      }))
    } catch (e) {
      set((s) => ({
        loadingBySubject: { ...s.loadingBySubject, [subjectId]: false },
        errorBySubject: {
          ...s.errorBySubject,
          [subjectId]: e instanceof Error ? e.message : 'Fehler beim Laden',
        },
      }))
    }
  },

  createTopic: async ({ subjectId, name }) => {
    const created = await topicRepo.create({ subjectId, name })
    await get().refreshBySubject(subjectId)
    return created
  },

  renameTopic: async (id, subjectId, name) => {
    const updated = await topicRepo.update(id, { name })
    await get().refreshBySubject(subjectId)
    return updated
  },

  deleteTopic: async (id, subjectId) => {
    await topicRepo.delete(id)
    await get().refreshBySubject(subjectId)
  },

  moveTopic: async (subjectId, topicId, direction) => {
    const topics = get().topicsBySubject[subjectId] ?? []
    const idx = topics.findIndex((t) => t.id === topicId)
    if (idx === -1) return

    const swapWith = direction === 'up' ? idx - 1 : idx + 1
    if (swapWith < 0 || swapWith >= topics.length) return

    const a = topics[idx]
    const b = topics[swapWith]
    await Promise.all([
      topicRepo.update(a.id, { orderIndex: b.orderIndex }),
      topicRepo.update(b.id, { orderIndex: a.orderIndex }),
    ])
    await get().refreshBySubject(subjectId)
  },
}))

