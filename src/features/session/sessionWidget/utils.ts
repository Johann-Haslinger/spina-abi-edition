import type { ActiveSession } from '../../../stores/activeSessionStore';

export function getElapsedMs(active: ActiveSession, nowMs: number) {
  const pausedTotalMs = active.pausedTotalMs ?? 0;
  if (active.pausedAtMs) {
    return Math.max(0, active.pausedAtMs - active.startedAtMs - pausedTotalMs);
  }
  return Math.max(0, nowMs - active.startedAtMs - pausedTotalMs);
}
