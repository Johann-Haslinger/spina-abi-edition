import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AutoBreadcrumbs } from '../../../components/AutoBreadcrumbs'
import { PageHeader } from '../../../components/PageHeader'
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
  const location = useLocation()
  const { active, start } = useActiveSessionStore()
  const from = (location.state as { from?: string } | null)?.from

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
      <PageHeader
        breadcrumb={<AutoBreadcrumbs />}
        title={
          subject ? `${subject.iconEmoji ? subject.iconEmoji + ' ' : ''}${subject.name}` : 'Fach'
        }
        actions={
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true)
            }}
            className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Thema anlegen
          </button>
        }
      />

      <div>
        

        {subjectsLoading || topicsLoading ? (
          <div className="mt-3 text-sm text-slate-400">Lade…</div>
        ) : (
          <>
            {topicsError ? (
              <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                {topicsError}
              </div>
            ) : null}

            
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
                    from={from}
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
                      navigate(`/subjects/${subjectId}/topics/${tid}`, {
                        state: { from },
                      })
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

