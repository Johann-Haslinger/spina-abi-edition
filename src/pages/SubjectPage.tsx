import { ArrowDown, ArrowUp, Pencil, Play, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import type { Topic } from '../domain/models'
import { useActiveSessionStore } from '../stores/activeSessionStore'
import { useSubjectsStore } from '../stores/subjectsStore'
import { useTopicsStore } from '../stores/topicsStore'

export function SubjectPage() {
  const { subjectId } = useParams()
  const navigate = useNavigate()
  const { active, start } = useActiveSessionStore()

  const { subjects, loading: subjectsLoading, refresh: refreshSubjects } =
    useSubjectsStore()
  const {
    topicsBySubject,
    loadingBySubject,
    errorBySubject,
    refreshBySubject,
    createTopic,
    renameTopic,
    deleteTopic,
    moveTopic,
  } = useTopicsStore()

  useEffect(() => {
    void refreshSubjects()
  }, [refreshSubjects])

  useEffect(() => {
    if (subjectId) void refreshBySubject(subjectId)
  }, [subjectId, refreshBySubject])

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId],
  )
  const topics = subjectId ? topicsBySubject[subjectId] ?? [] : []
  const topicsLoading = subjectId ? (loadingBySubject[subjectId] ?? false) : false
  const topicsError = subjectId ? errorBySubject[subjectId] : undefined

  const [newTopicName, setNewTopicName] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            {subject ? subject.name : 'Fach'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Themen sind die Einheit für Sessions & Analytics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
        >
          Zurück
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm font-semibold text-slate-200">Themen</div>

        {subjectsLoading || topicsLoading ? (
          <div className="mt-3 text-sm text-slate-400">Lade…</div>
        ) : !subjectId ? (
          <div className="mt-3 text-sm text-slate-400">Ungültiges Fach.</div>
        ) : !subject ? (
          <div className="mt-3 space-y-3">
            <div className="text-sm text-slate-400">
              Fach nicht gefunden (ID: <span className="font-mono">{subjectId}</span>
              ).
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Zurück zum Dashboard
            </button>
          </div>
        ) : (
          <>
            {topicsError ? (
              <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                {topicsError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <div className="text-xs font-semibold text-slate-300">
                  Neues Thema
                </div>
                <input
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="z.B. Analysis"
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const name = newTopicName.trim()
                  if (!name) return
                  void createTopic({ subjectId, name }).then(() => {
                    setNewTopicName('')
                  })
                }}
                className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                disabled={!newTopicName.trim()}
              >
                Thema anlegen
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">
                Noch keine Themen. Lege z.B. „Analysis“, „Stochastik“, „Vektoren“
                an.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {topics.map((t, i) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                  >
                    <Link
                      to={`/subjects/${subjectId}/topics/${t.id}`}
                      className="min-w-0 truncate text-sm font-semibold text-slate-50 hover:underline"
                    >
                      {t.name}
                    </Link>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!subjectId) return
                          if (
                            active &&
                            !window.confirm(
                              'Es läuft bereits eine Session. Neue Session starten?',
                            )
                          ) {
                            return
                          }
                          start({ subjectId, topicId: t.id })
                          navigate(`/subjects/${subjectId}/topics/${t.id}`)
                        }}
                        className="rounded-md p-2 text-emerald-200 hover:bg-emerald-950/40"
                        aria-label="Session starten"
                        title="Session starten"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveTopic(subjectId, t.id, 'up')}
                        disabled={i === 0}
                        className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50 disabled:opacity-30"
                        aria-label="Nach oben"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveTopic(subjectId, t.id, 'down')}
                        disabled={i === topics.length - 1}
                        className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50 disabled:opacity-30"
                        aria-label="Nach unten"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditing(t)
                          setEditName(t.name)
                          setEditOpen(true)
                        }}
                        className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                        aria-label="Umbenennen"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Thema „${t.name}“ wirklich löschen? (Assets/Folder werden mit gelöscht)`,
                            )
                          ) {
                            void deleteTopic(t.id, subjectId)
                          }
                        }}
                        className="rounded-md p-2 text-rose-200 hover:bg-rose-950/50"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Modal
        open={editOpen}
        title="Thema umbenennen"
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
                const name = editName.trim()
                if (!editing || !subjectId || !name) return
                setSaving(true)
                void renameTopic(editing.id, subjectId, name).finally(() => {
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

