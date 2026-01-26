import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../../components/Modal'
import type { Attempt } from '../../../domain/models'
import { attemptRepo, studySessionRepo } from '../../../repositories'

type Row = { attempt: Attempt; problemIdx: number; subproblemLabel: string }

export function ExerciseReviewModal(props: {
  open: boolean
  onClose: () => void
  studySessionId: string | null
  assetId: string
  onGoToTopic: () => void
  onEndSession: () => Promise<void> | void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!props.open) return
      if (!props.studySessionId) {
        setRows([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        await studySessionRepo.get(props.studySessionId)
        const r = await attemptRepo.listForSessionAsset({
          studySessionId: props.studySessionId,
          assetId: props.assetId,
        })
        if (!cancelled) setRows(r)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [props.open, props.studySessionId, props.assetId])

  const stats = useMemo(() => {
    const totalSeconds = rows.reduce((acc, r) => acc + r.attempt.seconds, 0)
    const correct = rows.filter((r) => r.attempt.result === 'correct').length
    const partial = rows.filter((r) => r.attempt.result === 'partial').length
    const wrong = rows.filter((r) => r.attempt.result === 'wrong').length
    return { totalSeconds, correct, partial, wrong, count: rows.length }
  }, [rows])

  const grouped = useMemo(() => {
    const byProblem = new Map<number, Map<string, Attempt[]>>()
    for (const r of rows) {
      const p = r.problemIdx
      const l = r.subproblemLabel
      const sub = byProblem.get(p) ?? new Map<string, Attempt[]>()
      const arr = sub.get(l) ?? []
      arr.push(r.attempt)
      sub.set(l, arr)
      byProblem.set(p, sub)
    }
    const problems = Array.from(byProblem.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([problemIdx, sub]) => ({
        problemIdx,
        subproblems: Array.from(sub.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, attempts]) => ({
            label,
            attempts: attempts.slice().sort((a, b) => b.endedAtMs - a.endedAtMs),
          })),
      }))
    return problems
  }, [rows])

  return (
    <Modal
      open={props.open}
      title="Übung – Review (Session)"
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            onClick={props.onEndSession}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Session beenden
          </button>
          <button
            type="button"
            onClick={props.onGoToTopic}
            className="ml-auto rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
          >
            Zum Thema
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Weiter
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded bg-slate-900 px-2 py-1">
            Versuche: {stats.count}
          </span>
          <span className="rounded bg-slate-900 px-2 py-1">
            ✅ {stats.correct}
          </span>
          <span className="rounded bg-slate-900 px-2 py-1">
            🟨 {stats.partial}
          </span>
          <span className="rounded bg-slate-900 px-2 py-1">
            ❌ {stats.wrong}
          </span>
          <span className="rounded bg-slate-900 px-2 py-1">
            Zeit: {formatDuration(stats.totalSeconds)}
          </span>
        </div>

        {loading ? <div className="text-sm text-slate-400">Lade…</div> : null}
        {error ? (
          <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          rows.length ? (
            <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
              {grouped.map((p) => (
                <div
                  key={p.problemIdx}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="text-sm font-semibold text-slate-100">
                    Aufgabe {p.problemIdx}
                  </div>
                  <div className="mt-2 space-y-2">
                    {p.subproblems.map((sp) => (
                      <div
                        key={`${p.problemIdx}:${sp.label}`}
                        className="rounded-md border border-slate-800 bg-slate-950/30 p-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-100">
                            Teilaufgabe {sp.label}
                          </div>
                          <span className="text-xs text-slate-400">
                            Versuche: {sp.attempts.length}
                          </span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {sp.attempts.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-md border border-slate-800 bg-slate-950/50 p-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-slate-400">
                                    {new Date(a.endedAtMs).toLocaleTimeString()} ·{' '}
                                    {formatDuration(a.seconds)}
                                  </div>
                                  {a.errorType ? (
                                    <div className="mt-1 text-xs text-rose-200">
                                      Fehler: {a.errorType}
                                    </div>
                                  ) : null}
                                  {a.note ? (
                                    <div className="mt-1 text-xs text-slate-200">
                                      Notiz: {a.note}
                                    </div>
                                  ) : null}
                                </div>
                                <ResultBadge result={a.result} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              Keine Versuche in dieser Übung (in der aktuellen Session).
            </div>
          )
        ) : null}
      </div>
    </Modal>
  )
}

function ResultBadge(props: { result: Attempt['result'] }) {
  const label = props.result === 'correct' ? '✅' : props.result === 'partial' ? '🟨' : '❌'
  const cls =
    props.result === 'correct'
      ? 'bg-emerald-950/40 text-emerald-200 border-emerald-900/50'
      : props.result === 'partial'
        ? 'bg-amber-950/40 text-amber-200 border-amber-900/50'
        : 'bg-rose-950/40 text-rose-200 border-rose-900/50'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-sm ${cls}`}>
      {label}
    </span>
  )
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
