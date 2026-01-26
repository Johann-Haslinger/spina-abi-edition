import type { ActiveSession } from '../../../stores/activeSessionStore'

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function getElapsedMs(active: ActiveSession, nowMs: number) {
  const pausedTotalMs = active.pausedTotalMs ?? 0
  if (active.pausedAtMs) {
    return Math.max(0, active.pausedAtMs - active.startedAtMs - pausedTotalMs)
  }
  return Math.max(0, nowMs - active.startedAtMs - pausedTotalMs)
}

