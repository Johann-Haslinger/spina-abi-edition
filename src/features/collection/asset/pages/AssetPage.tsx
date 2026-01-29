import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { AutoBreadcrumbs } from '../../../../components/AutoBreadcrumbs'
import type { Asset } from '../../../../domain/models'
import { assetRepo } from '../../../../repositories'
import { ErrorPage } from '../../../common/ErrorPage'
import { NotFoundPage } from '../../../common/NotFoundPage'
import { ExerciseAssetView } from '../views/ExerciseAssetView'

export function AssetPage() {
  const { assetId } = useParams()
  useLocation()

  const { asset, loading, error } = useAsset(assetId)

  const state = useMemo(() => {
    if (!assetId) return { kind: 'notfound' as const }
    if (loading) return { kind: 'loading' as const }
    if (error) return { kind: 'error' as const, error }
    if (!asset) return { kind: 'notfound' as const }
    return { kind: 'ready' as const, asset }
  }, [assetId, loading, error, asset])

  if (state.kind === 'notfound') return <NotFoundPage />
  if (state.kind === 'loading') return <div className="text-sm text-slate-400">Lade…</div>
  if (state.kind === 'error') return <ErrorPage title="Fehler beim Laden" message={state.error} />

  const a = state.asset

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <AutoBreadcrumbs />
          <h1 className="truncate text-2xl font-semibold text-slate-50">{a.title}</h1>
          <p className="mt-1 text-sm text-slate-400">Asset</p>
        </div>
      </div>

      {a.type === 'exercise' ? (
        <ExerciseAssetView assetId={a.id} />
      ) : (
        <NotFoundPage />
      )}
    </div>
  )
}

function useAsset(assetId: string | undefined) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!assetId) return
      setLoading(true)
      setError(null)
      try {
        const a = await assetRepo.get(assetId)
        if (!cancelled) setAsset(a ?? null)
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

  return { asset, loading, error }
}

