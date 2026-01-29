import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import type { Subject } from '../../domain/models'
import { useSubjectsStore } from '../../stores/subjectsStore'
import { SubjectItem } from '../dashboard/components/SubjectItem'
import { UpsertSubjectModal } from '../dashboard/modals/UpsertSubjectModal'

export function CollectionPage() {
  const { subjects, loading, error, refresh, createSubject, updateSubject, deleteSubject } =
    useSubjectsStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(subject: Subject) {
    setEditing(subject)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
        <PageHeader
          title="Sammlung"
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Fach anlegen
            </button>
          }
        />

      <div >
    
        {error ? (
          <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-3 text-sm text-slate-400">Lade…</div>
        ) : subjects.length === 0 ? (
          <div className="mt-3 text-sm text-slate-400">
            Noch keine Fächer. Lege dein erstes Fach im Dashboard an.
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            {subjects.map((s) => (
              <SubjectItem
                key={s.id}
                subject={s}
                onEdit={openEdit}
              />
            ))}
          </ul>
        )}
      </div>

      <UpsertSubjectModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        subject={editing ?? undefined}
        initial={
          editing
            ? {
                name: editing.name,
                color: editing.color,
                iconEmoji: editing.iconEmoji,
              }
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onSave={async (input) => {
          if (editing) {
            await updateSubject(editing.id, input)
          } else {
            await createSubject(input)
          }
        }}
        onDelete={
          editing
            ? async () => {
                await deleteSubject(editing.id)
              }
            : undefined
        }
      />
    </div>
  )
}

