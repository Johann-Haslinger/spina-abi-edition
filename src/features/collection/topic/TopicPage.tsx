import {
  FileUp,
  FolderPlus,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Asset, AssetType, Folder } from '../../../domain/models'
import { downloadBlob, openBlobInNewTab } from '../../../lib/blob'
import { exerciseRepo } from '../../../repositories'
import { useActiveSessionStore } from '../../../stores/activeSessionStore'
import { useAssetsStore } from '../../../stores/assetsStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSubjectsStore } from '../../../stores/subjectsStore'
import { useTopicsStore } from '../../../stores/topicsStore'
import { NotFoundPage } from '../../common/NotFoundPage'
import {
  SessionSummaryModal,
  type SessionSummaryState,
} from '../../session/modals/SessionSummaryModal'
import { AssetItem } from './components/AssetItem'
import { FilterChip } from './components/FilterChip'
import { FolderTree } from './components/FolderTree'
import { UploadAssetModal } from './modals/UploadAssetModal'
import { UpsertFolderModal } from './modals/UpsertFolderModal'

export function TopicPage() {
  const { subjectId, topicId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { active } = useActiveSessionStore()

  const { subjects, refresh: refreshSubjects } = useSubjectsStore()
  const { topicsBySubject, refreshBySubject } = useTopicsStore()
  const {
    foldersByTopic,
    loadingByTopic,
    errorByTopic,
    refreshByTopic,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useFoldersStore()

  const {
    assetsByTopic,
    loadingByTopic: assetsLoadingByTopic,
    errorByTopic: assetsErrorByTopic,
    refreshByTopic: refreshAssetsByTopic,
    createWithFile,
    deleteAsset,
    getFile,
  } = useAssetsStore()

  useEffect(() => {
    void refreshSubjects()
  }, [refreshSubjects])

  useEffect(() => {
    if (subjectId) void refreshBySubject(subjectId)
  }, [subjectId, refreshBySubject])

  useEffect(() => {
    if (topicId) void refreshByTopic(topicId)
  }, [topicId, refreshByTopic])

  useEffect(() => {
    if (topicId) void refreshAssetsByTopic(topicId)
  }, [topicId, refreshAssetsByTopic])

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId],
  )

  const topic = useMemo(() => {
    if (!subjectId) return undefined
    return (topicsBySubject[subjectId] ?? []).find((t) => t.id === topicId)
  }, [topicsBySubject, subjectId, topicId])

  const folders = useMemo(
    () => (topicId ? foldersByTopic[topicId] ?? [] : []),
    [foldersByTopic, topicId],
  )
  const foldersLoading = topicId ? (loadingByTopic[topicId] ?? false) : false
  const foldersError = topicId ? errorByTopic[topicId] : undefined

  const [createOpen, setCreateOpen] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Folder | null>(null)

  const assets = useMemo(
    () => (topicId ? assetsByTopic[topicId] ?? [] : []),
    [assetsByTopic, topicId],
  )
  const assetsLoading = topicId
    ? (assetsLoadingByTopic[topicId] ?? false)
    : false
  const assetsError = topicId ? assetsErrorByTopic[topicId] : undefined

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of folders) map.set(f.id, f.name)
    return map
  }, [folders])

  const [assetFilter, setAssetFilter] = useState<'all' | AssetType>('all')

  const [sessionSummary, setSessionSummary] = useState<SessionSummaryState | null>(null)
  useEffect(() => {
    const s = (location.state as { sessionSummary?: SessionSummaryState } | null)?.sessionSummary
    if (!s) return
    setSessionSummary(s)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const filteredAssets = useMemo(() => {
    if (assetFilter === 'all') return assets
    return assets.filter((a) => a.type === assetFilter)
  }, [assets, assetFilter])

  const [exerciseStatusByAssetId, setExerciseStatusByAssetId] = useState<Record<string, 'unknown' | 'partial' | 'captured' | 'covered'>>({})

  useEffect(() => {
    let cancelled = false
    async function run() {
      const exerciseIds = assets.filter((a) => a.type === 'exercise').map((a) => a.id)
      if (exerciseIds.length === 0) {
        if (!cancelled) setExerciseStatusByAssetId({})
        return
      }
      const pairs = await Promise.all(
        exerciseIds.map(async (id) => {
          const ex = await exerciseRepo.getByAsset(id)
          return [id, ex?.status ?? 'unknown'] as const
        }),
      )
      if (!cancelled) setExerciseStatusByAssetId(Object.fromEntries(pairs))
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [assets])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<AssetType>('exercise')

  function startUpload(type: AssetType) {
    setUploadType(type)
    fileInputRef.current?.click()
  }

  async function openAsset(asset: Asset) {
    if (asset.type === 'exercise') {
      if (active) navigate(`/study/${asset.id}`)
      else navigate(`/assets/${asset.id}`)
      return
    }
    const file = await getFile(asset.id)
    if (!file) return
    openBlobInNewTab(file.blob)
  }

  async function downloadAsset(asset: Asset) {
    const file = await getFile(asset.id)
    if (!file) return
    downloadBlob(file.blob, file.originalName)
  }

  if (!subjectId || !topicId) return <NotFoundPage />
  if (subjects.length > 0 && !subject) return <NotFoundPage />
  if (!topic && (topicsBySubject[subjectId]?.length ?? 0) > 0)
    return <NotFoundPage />

  return (
    <div className="space-y-6">
      <SessionSummaryModal
        key={
          sessionSummary
            ? `${sessionSummary.startedAtMs}-${sessionSummary.endedAtMs}`
            : 'none'
        }
        open={!!sessionSummary}
        onClose={() => setSessionSummary(null)}
        summary={sessionSummary}
        subjectName={subject?.name}
        topicName={topic?.name}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            {subject?.iconEmoji ? `${subject.iconEmoji} ` : ''}
            {subject?.name ?? 'Fach'}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-50">
            {topic?.iconEmoji ? `${topic.iconEmoji} ` : ''}
            {topic?.name ?? 'Thema'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Folder sind nur Organisation (keine Logik).
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/subjects/${subjectId}`)}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
        >
          Zurück
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-200">Folder</div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
            >
              <FolderPlus className="h-4 w-4" />
              Folder
            </button>
          </div>

          {foldersError ? (
            <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {foldersError}
            </div>
          ) : null}

          {foldersLoading ? (
            <div className="mt-3 text-sm text-slate-400">Lade…</div>
          ) : folders.length === 0 ? (
            <div className="mt-3 text-sm text-slate-400">
              Noch keine Folder. Optional: lege Folder für bessere Übersicht an.
            </div>
          ) : (
            <FolderTree
              folders={folders}
              onRename={(f) => {
                setEditing(f)
                setEditOpen(true)
              }}
              onDelete={(f) => {
                if (
                  window.confirm(
                    `Folder „${f.name}“ löschen? (Unterfolder werden eine Ebene hochgezogen)`,
                  )
                ) {
                  void deleteFolder(f.id, topicId)
                }
              }}
            />
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-200">Assets</div>
              <p className="mt-1 text-sm text-slate-400">
                Uploads sind lokal gespeichert (IndexedDB). Für große Sammlungen
                ist später Supabase Storage geplant.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startUpload('exercise')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                <FileUp className="h-4 w-4" />
                Übung hochladen
              </button>
              <button
                type="button"
                onClick={() => startUpload('cheatsheet')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
              >
                <FileUp className="h-4 w-4" />
                Merkblatt
              </button>
              <button
                type="button"
                onClick={() => startUpload('note')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
              >
                <FileUp className="h-4 w-4" />
                Notiz
              </button>
              <button
                type="button"
                onClick={() => startUpload('file')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
              >
                <FileUp className="h-4 w-4" />
                Datei
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.currentTarget.value = ''
              if (!f) return
              setUploadFile(f)
              setUploadOpen(true)
            }}
          />

          {assetsError ? (
            <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {assetsError}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FilterChip
              active={assetFilter === 'all'}
              onClick={() => setAssetFilter('all')}
              label="Alle"
            />
            <FilterChip
              active={assetFilter === 'exercise'}
              onClick={() => setAssetFilter('exercise')}
              label="Übungen"
            />
            <FilterChip
              active={assetFilter === 'cheatsheet'}
              onClick={() => setAssetFilter('cheatsheet')}
              label="Merkblätter"
            />
            <FilterChip
              active={assetFilter === 'note'}
              onClick={() => setAssetFilter('note')}
              label="Notizen"
            />
            <FilterChip
              active={assetFilter === 'file'}
              onClick={() => setAssetFilter('file')}
              label="Dateien"
            />

            <button
              type="button"
              onClick={() => void refreshAssetsByTopic(topicId)}
              className="ml-auto rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
            >
              Aktualisieren
            </button>
          </div>

          {assetsLoading ? (
            <div className="mt-3 text-sm text-slate-400">Lade…</div>
          ) : filteredAssets.length === 0 ? (
            <div className="mt-3 text-sm text-slate-400">
              Keine Assets in dieser Ansicht.
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {filteredAssets.map((a) => (
                <AssetItem
                  key={a.id}
                  asset={a}
                  folderLabel={
                    a.folderId ? folderNameById.get(a.folderId) ?? '—' : '(Root)'
                  }
                  exerciseStatus={a.type === 'exercise' ? exerciseStatusByAssetId[a.id] : undefined}
                  onOpen={() => void openAsset(a)}
                  onDownload={() => void downloadAsset(a)}
                  onDelete={() => {
                    if (window.confirm(`Asset „${a.title}“ löschen?`)) {
                      void deleteAsset(a.id, topicId)
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <UploadAssetModal
        open={uploadOpen}
        file={uploadFile}
        initialType={uploadType}
        folders={folders}
        onClose={() => setUploadOpen(false)}
        onSubmit={async (input) => {
          if (!input.file) return
          try {
            await createWithFile({
              subjectId,
              topicId,
              folderId: input.folderId,
              type: input.type,
              title: input.title,
              file: input.file,
            })
          } finally {
            setUploadFile(null)
          }
        }}
      />

      <UpsertFolderModal
        open={createOpen}
        mode="create"
        folders={folders}
        onClose={() => setCreateOpen(false)}
        onSave={async (input) => {
          await createFolder({
            topicId,
            name: input.name,
            iconEmoji: input.iconEmoji,
            parentFolderId: input.parentFolderId,
          })
        }}
      />

      <UpsertFolderModal
        open={editOpen}
        mode="edit"
        folders={folders}
        initial={
          editing
            ? {
                name: editing.name,
                iconEmoji: editing.iconEmoji,
                parentFolderId: editing.parentFolderId,
              }
            : undefined
        }
        onClose={() => setEditOpen(false)}
        onSave={async (input) => {
          if (!editing) return
          await renameFolder(editing.id, topicId, {
            name: input.name,
            iconEmoji: input.iconEmoji,
          })
        }}
      />
    </div>
  )
}
