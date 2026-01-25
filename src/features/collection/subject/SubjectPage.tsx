import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Topic } from '../../../domain/models'
import { useActiveSessionStore } from '../../../stores/activeSessionStore'
import { useSubjectsStore } from '../../../stores/subjectsStore'
import { useTopicsStore } from '../../../stores/topicsStore'
import { NotFoundPage } from '../../common/NotFoundPage'
import { TopicItem } from './components/TopicItem'
import { UpsertTopicModal } from './modals/UpsertTopicModal'

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

  const [createOpen, setCreateOpen] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)

  if (!subjectId) return <NotFoundPage />
  if (!subjectsLoading && !subject) return <NotFoundPage />

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            {subject ? `${subject.iconEmoji ? subject.iconEmoji + ' ' : ''}${subject.name}` : 'Fach'}
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
        ) : (
          <>
            {topicsError ? (
              <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                {topicsError}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(true)
                }}
                className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
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
                  <TopicItem
                    key={t.id}
                    subjectId={subjectId}
                    topic={t}
                    index={i}
                    total={topics.length}
                    onStartSession={(tid) => {
                      if (
                        active &&
                        !window.confirm(
                          'Es läuft bereits eine Session. Neue Session starten?',
                        )
                      ) {
                        return
                      }
                      start({ subjectId, topicId: tid })
                      navigate(`/subjects/${subjectId}/topics/${tid}`)
                    }}
                    onMove={(tid, dir) => void moveTopic(subjectId, tid, dir)}
                    onEdit={(topic) => {
                      setEditing(topic)
                      setEditOpen(true)
                    }}
                    onDelete={(topic) => {
                      if (
                        window.confirm(
                          `Thema „${topic.name}“ wirklich löschen? (Assets/Folder werden mit gelöscht)`,
                        )
                      ) {
                        void deleteTopic(topic.id, subjectId)
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <UpsertTopicModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSave={async (input) => {
          await createTopic({ subjectId, ...input })
        }}
      />

      <UpsertTopicModal
        open={editOpen}
        mode="edit"
        initial={
          editing
            ? { name: editing.name, iconEmoji: editing.iconEmoji }
            : undefined
        }
        onClose={() => setEditOpen(false)}
        onSave={async (input) => {
          if (!editing) return
          await renameTopic(editing.id, subjectId, input)
        }}
      />
    </div>
  )
}

