import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ActiveSessionMode = 'review' | 'focus'

export type ActiveSession = {
  subjectId: string
  topicId: string
  startedAtMs: number
  plannedDurationMs?: number
  pausedAtMs?: number
  pausedTotalMs?: number
  mode: ActiveSessionMode
}

type ActiveSessionState = {
  active: ActiveSession | null
  start: (input: { subjectId: string; topicId: string; plannedDurationMs?: number }) => void
  end: () => void
  setMode: (mode: ActiveSessionMode) => void
  pause: () => void
  resume: () => void
  togglePause: () => void
  setPlannedDurationMs: (ms: number | undefined) => void
  extendPlannedDurationMs: (deltaMs: number) => void
}

export const useActiveSessionStore = create<ActiveSessionState>()(
  persist(
    (set) => ({
      active: null,

      start: ({ subjectId, topicId, plannedDurationMs }) =>
        set({
          active: {
            subjectId,
            topicId,
            startedAtMs: Date.now(),
            plannedDurationMs,
            pausedAtMs: undefined,
            pausedTotalMs: 0,
            mode: 'review',
          },
        }),

      end: () => set({ active: null }),

      setMode: (mode) => set((s) => (s.active ? { active: { ...s.active, mode } } : s)),

      pause: () =>
        set((s) => {
          if (!s.active) return s
          if (s.active.pausedAtMs) return s
          return { active: { ...s.active, pausedAtMs: Date.now() } }
        }),

      resume: () =>
        set((s) => {
          if (!s.active) return s
          if (!s.active.pausedAtMs) return s
          const pausedAtMs = s.active.pausedAtMs
          const pausedTotalMs = (s.active.pausedTotalMs ?? 0) + (Date.now() - pausedAtMs)
          return { active: { ...s.active, pausedAtMs: undefined, pausedTotalMs } }
        }),

      togglePause: () =>
        set((s) => {
          if (!s.active) return s
          if (s.active.pausedAtMs) {
            const pausedAtMs = s.active.pausedAtMs
            const pausedTotalMs = (s.active.pausedTotalMs ?? 0) + (Date.now() - pausedAtMs)
            return { active: { ...s.active, pausedAtMs: undefined, pausedTotalMs } }
          }
          return { active: { ...s.active, pausedAtMs: Date.now() } }
        }),

      setPlannedDurationMs: (ms) =>
        set((s) => (s.active ? { active: { ...s.active, plannedDurationMs: ms } } : s)),

      extendPlannedDurationMs: (deltaMs) =>
        set((s) => {
          if (!s.active) return s
          const next = (s.active.plannedDurationMs ?? 0) + deltaMs
          return { active: { ...s.active, plannedDurationMs: next } }
        }),
    }),
    {
      name: 'mathe-abi-2026:active-session',
      partialize: (s) => ({ active: s.active }),
      version: 1,
    },
  ),
)

