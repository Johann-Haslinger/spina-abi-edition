import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../../../components/Modal'
import type { Asset } from '../../../domain/models'
import { assetFileStore, assetRepo, studySessionRepo } from '../../../repositories'
import { useActiveSessionStore } from '../../../stores/activeSessionStore'
import { ErrorPage } from '../../common/ErrorPage'
import { NotFoundPage } from '../../common/NotFoundPage'
import type { AssetFile } from '../../../domain/models'
import { FloatingQuickLogPanel } from '../components/FloatingQuickLogPanel'
import { useStudyStore } from '../stores/studyStore'
import { AssetViewer } from '../viewer/AssetViewer'
import { ExerciseReviewModal } from '../modals/ExerciseReviewModal'
import type { SessionSummaryState } from '../modals/SessionSummaryModal'

export function StudyPage() {
  const { assetId } = useParams()
  const navigate = useNavigate()
  const { active, start, end } = useActiveSessionStore()

  const { asset, file, pdfData, loading, error } = useStudyAssetData(assetId)
  const [pageNumber, setPageNumber] = useState(1)
  const [reviewOpen, setReviewOpen] = useState(false)

  const {
    studySessionId,
    attemptStartedAtMs,
    problemIdx,
    subproblemLabel,
    ensureStudySession,
    setProblemIdx,
    setSubproblemLabel,
    startAttempt,
    cancelAttempt,
    logAttempt,
    exerciseStatusByAssetId,
    loadExerciseStatus,
    setExerciseStatus,
    reset,
  } = useStudyStore()

  useEffect(() => {
    reset()
  }, [active?.startedAtMs, active?.subjectId, active?.topicId, reset])


  const guardState = useMemo(() => {
    if (!assetId) return { kind: 'notfound' as const }
    if (loading) return { kind: 'loading' as const }
    if (error) return { kind: 'error' as const, error }
    if (!asset) return { kind: 'notfound' as const }
    if (asset.type !== 'exercise') return { kind: 'notfound' as const }

    if (!active) {
      return { kind: 'needStart' as const, asset }
    }
    if (active.subjectId !== asset.subjectId || active.topicId !== asset.topicId) {
      return { kind: 'needSwitch' as const, asset }
    }
    return { kind: 'ok' as const, asset }
  }, [assetId, loading, error, asset, active])

  useEffect(() => {
    if (guardState.kind !== 'ok') return
    if (!active) return
    void ensureStudySession({
      subjectId: active.subjectId,
      topicId: active.topicId,
      startedAtMs: active.startedAtMs,
      plannedDurationMs: active.plannedDurationMs,
    })
  }, [guardState.kind, active, ensureStudySession])

  useEffect(() => {
    if (guardState.kind !== 'ok') return
    void loadExerciseStatus(guardState.asset.id)
  }, [guardState.kind, guardState.asset, loadExerciseStatus])

  const exerciseStatus =
    guardState.kind === 'ok'
      ? (exerciseStatusByAssetId[guardState.asset.id] ?? 'unknown')
      : 'unknown'

  if (guardState.kind === 'notfound') return <NotFoundPage />
  if (guardState.kind === 'loading')
    return <div className="text-sm text-slate-400">Lade…</div>
  if (guardState.kind === 'error')
    return <ErrorPage title="Fehler beim Laden" message={guardState.error} />

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-slate-50">
            {guardState.asset.title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Viewer + Quick-Log kommt als nächstes (diese Route ist der Guard).
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
        >
          Zurück
        </button>
      </div>

      <Modal
        open={guardState.kind === 'needStart'}
        title="Session starten?"
        onClose={() => navigate(-1)}
        footer={
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                const a = guardState.asset
                start({ subjectId: a.subjectId, topicId: a.topicId })
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Starten
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-300">
          Diese Übung gehört zu einem Thema. Für Tracking musst du eine Session
          starten.
        </div>
      </Modal>

      <Modal
        open={guardState.kind === 'needSwitch'}
        title="Session wechseln?"
        onClose={() => navigate(-1)}
        footer={
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                const a = guardState.asset
                end()
                start({ subjectId: a.subjectId, topicId: a.topicId })
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Wechseln
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-300">
          Diese Übung gehört zu einem anderen Thema als deine aktive Session.
        </div>
      </Modal>

      {guardState.kind === 'ok' ? (
        file ? (
          <>
            <AssetViewer
              title={guardState.asset.title}
              file={file}
              pdfData={pdfData}
              pageNumber={pageNumber}
              onPageNumberChange={setPageNumber}
            />

            <FloatingQuickLogPanel
              assetId={guardState.asset.id}
              pageNumber={pageNumber}
              exerciseStatus={exerciseStatus}
              problemIdx={problemIdx}
              subproblemLabel={subproblemLabel}
              attemptStartedAtMs={attemptStartedAtMs}
              onProblemIdxChange={setProblemIdx}
              onSubproblemLabelChange={setSubproblemLabel}
              onStartAttempt={startAttempt}
              onCancelAttempt={cancelAttempt}
              onSaveAttempt={async ({ result, note, errorType }) => {
                if (!active) throw new Error('Keine aktive Session')
                await ensureStudySession({
                  subjectId: active.subjectId,
                  topicId: active.topicId,
                  startedAtMs: active.startedAtMs,
                  plannedDurationMs: active.plannedDurationMs,
                })
                await logAttempt({
                  assetId: guardState.asset.id,
                  problemIdx,
                  subproblemLabel,
                  endedAtMs: Date.now(),
                  result,
                  note,
                  errorType,
                })
              }}
              onNextSubproblem={() => setSubproblemLabel(nextLabel(subproblemLabel))}
              onNewProblem={() => {
                setProblemIdx(problemIdx + 1)
                setSubproblemLabel('a')
              }}
              onMarkProgress={() => setReviewOpen(true)}
              onFinishExercise={async () => {
                await setExerciseStatus(guardState.asset.id, 'covered')
                setReviewOpen(true)
              }}
            />
          </>
        ) : (
          <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            Datei nicht gefunden (local file missing).
          </div>
        )
      ) : null}

      {guardState.kind === 'ok' ? (
        <ExerciseReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          studySessionId={studySessionId}
          assetId={guardState.asset.id}
          onGoToTopic={() => {
            setReviewOpen(false)
            if (active) navigate(`/subjects/${active.subjectId}/topics/${active.topicId}`)
          }}
          onEndSession={async () => {
            setReviewOpen(false)
            const endedAtMs = Date.now()
            const target = active
              ? `/subjects/${active.subjectId}/topics/${active.topicId}`
              : '/dashboard'
            const summary: SessionSummaryState | null = active
              ? {
                  studySessionId: studySessionId ?? undefined,
                  subjectId: active.subjectId,
                  topicId: active.topicId,
                  startedAtMs: active.startedAtMs,
                  endedAtMs,
                }
              : null

            if (studySessionId) await studySessionRepo.end(studySessionId, endedAtMs)
            end()
            reset()
            if (summary) navigate(target, { state: { sessionSummary: summary } })
            else navigate(target)
          }}
        />
      ) : null}

    </div>
  )
}

function useStudyAssetData(assetId: string | undefined) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<AssetFile | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!assetId) return
      setLoading(true)
      setError(null)
      try {
        const a = await assetRepo.get(assetId)
        if (!cancelled) setAsset(a ?? null)

        if (a) {
          const f = await assetFileStore.get(a.id)
          if (!cancelled && f) {
            setFile(f)
            const isPdf =
              f.mimeType === 'application/pdf' ||
              f.originalName.toLowerCase().endsWith('.pdf')
            if (isPdf) {
              const buf = await f.blob.arrayBuffer()
              setPdfData(new Uint8Array(buf).slice(0))
            } else {
              setPdfData(null)
            }
          } else if (!cancelled) {
            setFile(null)
            setPdfData(null)
          }
        } else if (!cancelled) {
          setFile(null)
          setPdfData(null)
        }
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
  }, [assetId])

  return { asset, file, pdfData, loading, error }
}

function nextLabel(label: string) {
  const l = label.trim()
  if (l.length !== 1) return l || 'a'
  const c = l.toLowerCase().charCodeAt(0)
  if (c < 97 || c > 122) return l
  if (c === 122) return 'a'
  return String.fromCharCode(c + 1)
}

