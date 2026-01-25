import { Download, ExternalLink, FileUp, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import type { Asset, AssetType, Folder } from '../domain/models'
import { downloadBlob, openBlobInNewTab } from '../lib/blob'
import { useAssetsStore } from '../stores/assetsStore'
import { useFoldersStore } from '../stores/foldersStore'
import { useSubjectsStore } from '../stores/subjectsStore'
import { useTopicsStore } from '../stores/topicsStore'

export function TopicPage() {
  const { subjectId, topicId } = useParams()
  const navigate = useNavigate()

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
  const [createName, setCreateName] = useState('')
  const [createParentId, setCreateParentId] = useState<string | ''>('')
  const [saving, setSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Folder | null>(null)
  const [editName, setEditName] = useState('')

  const assets = useMemo(
    () => (topicId ? assetsByTopic[topicId] ?? [] : []),
    [assetsByTopic, topicId],
  )
  const assetsLoading = topicId ? (assetsLoadingByTopic[topicId] ?? false) : false
  const assetsError = topicId ? assetsErrorByTopic[topicId] : undefined

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of folders) map.set(f.id, f.name)
    return map
  }, [folders])

  const [assetFilter, setAssetFilter] = useState<'all' | AssetType>('all')

  const filteredAssets = useMemo(() => {
    if (assetFilter === 'all') return assets
    return assets.filter((a) => a.type === assetFilter)
  }, [assets, assetFilter])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<AssetType>('exercise')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFolderId, setUploadFolderId] = useState<string | ''>('')

  function startUpload(type: AssetType) {
    setUploadType(type)
    fileInputRef.current?.click()
  }

  async function openAsset(asset: Asset) {
    const file = await getFile(asset.id)
    if (!file) return
    openBlobInNewTab(file.blob)
  }

  async function downloadAsset(asset: Asset) {
    const file = await getFile(asset.id)
    if (!file) return
    downloadBlob(file.blob, file.originalName)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            {subject?.name ?? 'Fach'}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-50">
            {topic?.name ?? 'Thema'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Folder sind nur Organisation (keine Logik).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (subjectId) navigate(`/subjects/${subjectId}`)
            else navigate('/dashboard')
          }}
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
              disabled={!topicId}
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
                setEditName(f.name)
                setEditOpen(true)
              }}
              onDelete={(f) => {
                if (
                  window.confirm(
                    `Folder „${f.name}“ löschen? (Unterfolder werden eine Ebene hochgezogen)`,
                  )
                ) {
                  if (topicId) void deleteFolder(f.id, topicId)
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
                disabled={!subjectId || !topicId}
              >
                <FileUp className="h-4 w-4" />
                Übung hochladen
              </button>
              <button
                type="button"
                onClick={() => startUpload('cheatsheet')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
                disabled={!subjectId || !topicId}
              >
                <FileUp className="h-4 w-4" />
                Merkblatt
              </button>
              <button
                type="button"
                onClick={() => startUpload('note')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
                disabled={!subjectId || !topicId}
              >
                <FileUp className="h-4 w-4" />
                Notiz
              </button>
              <button
                type="button"
                onClick={() => startUpload('file')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
                disabled={!subjectId || !topicId}
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
              const defaultTitle = f.name.replace(/\.[^.]+$/, '')
              setUploadTitle(defaultTitle)
              setUploadFolderId('')
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
              onClick={() => {
                if (topicId) void refreshAssetsByTopic(topicId)
              }}
              className="ml-auto rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
              disabled={!topicId}
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
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-50">
                      {a.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded bg-slate-900 px-2 py-0.5">
                        {assetTypeLabel(a.type)}
                      </span>
                      {a.folderId ? (
                        <span className="rounded bg-slate-900 px-2 py-0.5">
                          Folder: {folderNameById.get(a.folderId) ?? '—'}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-900 px-2 py-0.5">
                          Folder: (Root)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void openAsset(a)}
                      className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                      aria-label="Öffnen"
                      title="Öffnen"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadAsset(a)}
                      className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                      aria-label="Download"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!topicId) return
                        if (window.confirm(`Asset „${a.title}“ löschen?`)) {
                          void deleteAsset(a.id, topicId)
                        }
                      }}
                      className="rounded-md p-2 text-rose-200 hover:bg-rose-950/50"
                      aria-label="Löschen"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal
        open={uploadOpen}
        title="Asset hochladen"
        onClose={() => setUploadOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                if (!subjectId || !topicId || !uploadFile) return
                const title = uploadTitle.trim()
                if (!title) return
                setSaving(true)
                void createWithFile({
                  subjectId,
                  topicId,
                  folderId: uploadFolderId || undefined,
                  type: uploadType,
                  title,
                  file: uploadFile,
                }).finally(() => {
                  setSaving(false)
                  setUploadOpen(false)
                  setUploadFile(null)
                  setUploadTitle('')
                  setUploadFolderId('')
                })
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
              disabled={saving || !uploadFile || !uploadTitle.trim()}
            >
              Hochladen
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
            <div className="text-xs font-semibold text-slate-400">Datei</div>
            <div className="mt-0.5 flex items-center gap-2">
              <FileUp className="h-4 w-4 text-slate-400" />
              <span className="truncate">
                {uploadFile ? uploadFile.name : '—'}
              </span>
            </div>
          </div>

          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Typ</div>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as AssetType)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            >
              <option value="exercise">Übung</option>
              <option value="cheatsheet">Merkblatt</option>
              <option value="note">Notiz</option>
              <option value="file">Datei</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Titel</div>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Folder</div>
            <select
              value={uploadFolderId}
              onChange={(e) => setUploadFolderId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            >
              <option value="">(Root)</option>
              {flattenFoldersForSelect(folders).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        title="Folder anlegen"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                if (!topicId) return
                const name = createName.trim()
                if (!name) return
                setSaving(true)
                void createFolder({
                  topicId,
                  name,
                  parentFolderId: createParentId || undefined,
                }).finally(() => {
                  setSaving(false)
                  setCreateOpen(false)
                  setCreateName('')
                  setCreateParentId('')
                })
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
              disabled={saving || !createName.trim()}
            >
              Anlegen
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Name</div>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="z.B. IQB 2022"
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Parent</div>
            <select
              value={createParentId}
              onChange={(e) => setCreateParentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            >
              <option value="">(Root)</option>
              {flattenFoldersForSelect(folders).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-400">
              Folder beeinflussen keine Reviews/Sessions – nur UI.
            </div>
          </label>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        title="Folder umbenennen"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                if (!editing || !topicId) return
                const name = editName.trim()
                if (!name) return
                setSaving(true)
                void renameFolder(editing.id, topicId, name).finally(() => {
                  setSaving(false)
                  setEditOpen(false)
                })
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
              disabled={saving || !editName.trim()}
            >
              Speichern
            </button>
          </>
        }
      >
        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Name</div>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
        </label>
      </Modal>
    </div>
  )
}

function FolderTree(props: {
  folders: Folder[]
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}) {
  const { folders, onRename, onDelete } = props

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Folder[]>()
    const rootKey = '__root__'
    for (const f of folders) {
      const key = f.parentFolderId ?? rootKey
      const arr = map.get(key) ?? []
      arr.push(f)
      map.set(key, arr)
    }
    return { map, rootKey }
  }, [folders])

  const renderNode = (parentId: string, depth: number) => {
    const children = childrenByParent.map.get(parentId) ?? []
    if (children.length === 0) return null

    return (
      <ul className={depth === 0 ? 'mt-3 space-y-1' : 'mt-1 space-y-1'}>
        {children.map((f) => (
          <li key={f.id}>
            <div
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-900"
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <div className="min-w-0 truncate text-sm text-slate-200">
                {f.name}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRename(f)}
                  className="rounded-md p-1.5 text-slate-300 hover:bg-slate-950 hover:text-slate-50"
                  aria-label="Umbenennen"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(f)}
                  className="rounded-md p-1.5 text-rose-200 hover:bg-rose-950/50"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {renderNode(f.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return renderNode(childrenByParent.rootKey, 0)
}

function flattenFoldersForSelect(folders: Folder[]) {
  const rootKey = '__root__'
  const childrenByParent = new Map<string, Folder[]>()

  for (const f of folders) {
    const key = f.parentFolderId ?? rootKey
    const arr = childrenByParent.get(key) ?? []
    arr.push(f)
    childrenByParent.set(key, arr)
  }

  const out: Array<{ id: string; label: string }> = []
  const walk = (parentId: string, depth: number) => {
    for (const f of childrenByParent.get(parentId) ?? []) {
      out.push({ id: f.id, label: `${'—'.repeat(depth)} ${f.name}`.trim() })
      walk(f.id, depth + 1)
    }
  }
  walk(rootKey, 0)
  return out
}

function FilterChip(props: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        props.active
          ? 'rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50'
          : 'rounded-md bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-50'
      }
    >
      {props.label}
    </button>
  )
}

function assetTypeLabel(t: AssetType) {
  switch (t) {
    case 'exercise':
      return 'Übung'
    case 'cheatsheet':
      return 'Merkblatt'
    case 'note':
      return 'Notiz'
    case 'file':
      return 'Datei'
  }
}

