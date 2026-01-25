import { Clock, StopCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useActiveSessionStore } from '../stores/activeSessionStore'
import { useSubjectsStore } from '../stores/subjectsStore'
import { useTopicsStore } from '../stores/topicsStore'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ActiveSessionBanner() {
  const { active, end } = useActiveSessionStore()
  const { subjects } = useSubjectsStore()
  const { topicsBySubject } = useTopicsStore()

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])

  const subjectName = useMemo(() => {
    if (!active) return undefined
    return subjects.find((s) => s.id === active.subjectId)?.name
  }, [active, subjects])

  const topicName = useMemo(() => {
    if (!active) return undefined
    const topics = topicsBySubject[active.subjectId] ?? []
    return topics.find((t) => t.id === active.topicId)?.name
  }, [active, topicsBySubject])

  if (!active) return null

  const seconds = Math.max(0, Math.floor((nowMs - active.startedAtMs) / 1000))

  return (
    <div className="mb-6 rounded-xl border border-indigo-900/50 bg-indigo-950/30 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-indigo-200">
            Aktive Session
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-slate-50">
            {subjectName ?? active.subjectId} · {topicName ?? active.topicId}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded bg-slate-900/60 px-2 py-0.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(seconds)}
            </span>
            <span className="rounded bg-slate-900/60 px-2 py-0.5">
              Modus: {active.mode}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={end}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
        >
          <StopCircle className="h-4 w-4" />
          Session beenden
        </button>
      </div>
    </div>
  )
}

