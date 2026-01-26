import { useEffect, useState } from 'react'
import { Modal } from '../../../../components/Modal'
import type { Attempt, Problem, Subproblem } from '../../../../domain/models'
import { attemptRepo, exerciseRepo, problemRepo, subproblemRepo } from '../../../../repositories'

type DetailsState = {
  detailsLoading: boolean
  detailsError: string | null
  problems: Array<{
    problem: Problem
    subproblems: Array<{ subproblem: Subproblem; attempts: Attempt[] }>
  }>
}

export function ExerciseDetailsModal(props: {
  open: boolean
  assetId: string
  onClose: () => void
}) {
  const { detailsLoading, detailsError, problems } = useExerciseDetails(props.open, props.assetId)

  return (
    <Modal
      open={props.open}
      title="Übung – Details"
      onClose={props.onClose}
      footer={
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
        >
          Schließen
        </button>
      }
    >
      {detailsLoading ? <div className="text-sm text-slate-400">Lade…</div> : null}
      {detailsError ? (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {detailsError}
        </div>
      ) : null}

      {!detailsLoading && !detailsError ? (
        problems.length ? (
          <div className="space-y-3">
            {problems.map((p) => (
              <div
                key={p.problem.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="text-sm font-semibold text-slate-100">
                  Aufgabe {p.problem.idx}
                </div>
                <div className="mt-2 space-y-2">
                  {p.subproblems.map((sp) => (
                    <div
                      key={sp.subproblem.id}
                      className="rounded-md border border-slate-800 bg-slate-950/30 p-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">
                          Teilaufgabe {sp.subproblem.label}
                        </div>
                        <span className="text-xs text-slate-400">
                          Versuche: {sp.attempts.length}
                        </span>
                      </div>
                      {sp.attempts.length ? (
                        <div className="mt-2 space-y-2">
                          {sp.attempts.map((att) => (
                            <div
                              key={att.id}
                              className="rounded-md border border-slate-800 bg-slate-950/50 p-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-slate-400">
                                    {new Date(att.endedAtMs).toLocaleString()} ·{' '}
                                    {formatDuration(att.seconds)}
                                  </div>
                                  {att.errorType ? (
                                    <div className="mt-1 text-xs text-rose-200">
                                      Fehler: {att.errorType}
                                    </div>
                                  ) : null}
                                  {att.note ? (
                                    <div className="mt-1 text-xs text-slate-200">
                                      Notiz: {att.note}
                                    </div>
                                  ) : null}
                                </div>
                                <ResultBadge result={att.result} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-400">Keine Attempts erfasst.</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            Für diese Übung sind noch keine Problems/Subproblems erfasst.
          </div>
        )
      ) : null}
    </Modal>
  )
}

function useExerciseDetails(open: boolean, assetId: string): DetailsState {
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [problems, setProblems] = useState<DetailsState['problems']>([])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!open) return
      setDetailsLoading(true)
      setDetailsError(null)
      try {
        const exercise = await exerciseRepo.getByAsset(assetId)
        if (!exercise) {
          if (!cancelled) setProblems([])
          return
        }
        const probs = await problemRepo.listByExercise(exercise.id)
        const subs = await subproblemRepo.listByProblemIds(probs.map((p) => p.id))
        const attempts = await attemptRepo.listBySubproblemIds(subs.map((s) => s.id))

        const attemptsBySub = new Map<string, Attempt[]>()
        for (const a of attempts) {
          const arr = attemptsBySub.get(a.subproblemId) ?? []
          arr.push(a)
          attemptsBySub.set(a.subproblemId, arr)
        }
        for (const [k, arr] of attemptsBySub.entries()) {
          arr.sort((a, b) => b.endedAtMs - a.endedAtMs)
          attemptsBySub.set(k, arr)
        }

        const subsByProblem = new Map<string, Subproblem[]>()
        for (const s of subs) {
          const arr = subsByProblem.get(s.problemId) ?? []
          arr.push(s)
          subsByProblem.set(s.problemId, arr)
        }
        for (const [k, arr] of subsByProblem.entries()) {
          arr.sort((a, b) => a.label.localeCompare(b.label))
          subsByProblem.set(k, arr)
        }

        const grouped = probs
          .slice()
          .sort((a, b) => a.idx - b.idx)
          .map((p) => ({
            problem: p,
            subproblems: (subsByProblem.get(p.id) ?? []).map((sp) => ({
              subproblem: sp,
              attempts: attemptsBySub.get(sp.id) ?? [],
            })),
          }))
        if (!cancelled) setProblems(grouped)
      } catch (e) {
        if (!cancelled) setDetailsError(e instanceof Error ? e.message : 'Fehler')
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, assetId])

  return { detailsLoading, detailsError, problems }
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

