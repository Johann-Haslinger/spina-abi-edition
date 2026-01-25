import { create } from 'zustand'
import type { Subject } from '../domain/models'
import { subjectRepo } from '../repositories'
import { subjectColorOptions } from '../ui/subjectColors'

type SubjectsState = {
  subjects: Subject[]
  loading: boolean
  error?: string
  refresh: () => Promise<void>
  createSubject: (input: { name: string; color?: string }) => Promise<Subject>
  updateSubject: (
    id: string,
    patch: { name?: string; color?: string },
  ) => Promise<Subject>
  deleteSubject: (id: string) => Promise<void>
}

const defaultColor = subjectColorOptions[0]?.hex ?? '#6366F1'

export const useSubjectsStore = create<SubjectsState>((set, get) => ({
  subjects: [],
  loading: false,
  error: undefined,

  refresh: async () => {
    set({ loading: true, error: undefined })
    try {
      const subjects = await subjectRepo.list()
      set({ subjects, loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Fehler beim Laden',
      })
    }
  },

  createSubject: async (input) => {
    const created = await subjectRepo.create({
      name: input.name,
      color: input.color ?? defaultColor,
    })
    await get().refresh()
    return created
  },

  updateSubject: async (id, patch) => {
    const updated = await subjectRepo.update(id, patch)
    await get().refresh()
    return updated
  },

  deleteSubject: async (id) => {
    await subjectRepo.delete(id)
    await get().refresh()
  },
}))

