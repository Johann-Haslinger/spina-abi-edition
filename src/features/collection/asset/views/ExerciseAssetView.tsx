import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../../../components/Modal'
import type { Asset, AssetFile, ExercisePageStatus } from '../../../../domain/models'
import {
  assetFileStore,
  assetRepo,
  exerciseRepo,
} from '../../../../repositories'
import { useActiveSessionStore } from '../../../../stores/activeSessionStore'
import { ErrorPage } from '../../../common/ErrorPage'
import { NotFoundPage } from '../../../common/NotFoundPage'
import { AssetViewer } from '../../../session/viewer/AssetViewer'
import { ExerciseDetailsModal } from '../modals/ExerciseDetailsModal'

export function ExerciseAssetView(props: { assetId: string }) {
  const navigate = useNavigate()
  const { active, start, end } = useActiveSessionStore()

  const { asset, file, pdfData, loading, error } = useExerciseAssetData(props.assetId)
  const [pageNumber, setPageNumber] = useState(1)
  const { exerciseStatus } = useExerciseStatus(asset?.id)

  const [detailsOpen, setDetailsOpen] = useState(false)

  const state = useMemo(() => {
    if (loading) return { kind: 'loading' as const }
    if (error) return { kind: 'error' as const, error }
    if (!asset) return { kind: 'notfound' as const }
    if (asset.type !== 'exercise') return { kind: 'notfound' as const }

    if (!active) return { kind: 'noSession' as const, asset }
    if (active.subjectId !== asset.subjectId || active.topicId !== asset.topicId)
      return { kind: 'wrongSession' as const, asset }

    return { kind: 'ready' as const, asset }
  }, [loading, error, asset, active])

  if (state.kind === 'notfound') return <NotFoundPage />
  if (state.kind === 'loading') return <div className="text-sm text-slate-400">Lade…</div>
  if (state.kind === 'error') return <ErrorPage title="Fehler beim Laden" message={state.error} />

  const a = state.asset

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm font-semibold text-slate-200">Aktionen</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (state.kind === 'ready') {
                navigate(`/study/${a.id}`)
                return
              }
            }}
            className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            disabled={state.kind !== 'ready'}
          >
            Weiter lernen
          </button>

          <button
            type="button"
            onClick={() => {
              if (state.kind === 'noSession') {
                start({ subjectId: a.subjectId, topicId: a.topicId })
                navigate(`/study/${a.id}`)
              }
            }}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            disabled={state.kind !== 'noSession'}
          >
            Session starten
          </button>

          <button
            type="button"
            onClick={() => {
              if (state.kind === 'wrongSession') {
                // handled via modal below
              }
            }}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700 disabled:opacity-60"
            disabled={state.kind !== 'wrongSession'}
          >
            Session wechseln
          </button>

          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="ml-auto rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            disabled={!asset}
          >
            Details
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded bg-slate-900 px-2 py-0.5">Übungsstatus: {exerciseStatus}</span>
        </div>
      </div>

      {file ? (
        <AssetViewer
          title={a.title}
          file={file}
          pdfData={pdfData}
          pageNumber={pageNumber}
          onPageNumberChange={setPageNumber}
        />
      ) : (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          Datei nicht gefunden (local file missing).
        </div>
      )}

      <Modal
        open={state.kind === 'wrongSession'}
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
                end()
                start({ subjectId: a.subjectId, topicId: a.topicId })
                navigate(`/study/${a.id}`)
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Wechseln & starten
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-300">
          Du hast eine aktive Session in einem anderen Thema. Für korrektes Tracking solltest du wechseln.
        </div>
      </Modal>

      <ExerciseDetailsModal
        open={detailsOpen}
        assetId={a.id}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  )
}

function useExerciseStatus(assetId: string | undefined) {
  const [exerciseStatus, setExerciseStatus] = useState<ExercisePageStatus>('unknown')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!assetId) return
      const ex = await exerciseRepo.getByAsset(assetId)
      if (cancelled) return
      setExerciseStatus(ex?.status ?? 'unknown')
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [assetId])

  return { exerciseStatus }
}

function useExerciseAssetData(assetId: string) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<AssetFile | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
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
              f.mimeType === 'application/pdf' || f.originalName.toLowerCase().endsWith('.pdf')
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

