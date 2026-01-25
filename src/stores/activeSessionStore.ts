import { create } from 'zustand'

export type ActiveSessionMode = 'review' | 'focus'

export type ActiveSession = {
  subjectId: string
  topicId: string
  startedAtMs: number
  mode: ActiveSessionMode
}

type ActiveSessionState = {
  active: ActiveSession | null
  start: (input: { subjectId: string; topicId: string }) => void
  end: () => void
  setMode: (mode: ActiveSessionMode) => void
}

export const useActiveSessionStore = create<ActiveSessionState>((set) => ({
  active: null,

  start: ({ subjectId, topicId }) =>
    set({
      active: {
        subjectId,
        topicId,
        startedAtMs: Date.now(),
        mode: 'review',
      },
    }),

  end: () => set({ active: null }),

  setMode: (mode) =>
    set((s) => (s.active ? { active: { ...s.active, mode } } : s)),
}))

