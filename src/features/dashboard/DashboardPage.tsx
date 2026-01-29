import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import type { Subject } from '../../domain/models'
import { useSubjectsStore } from '../../stores/subjectsStore'
import { SubjectItem } from './components/SubjectItem'
import { UpsertSubjectModal } from './modals/UpsertSubjectModal'

export function DashboardPage() {
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
        title="Dashboard"
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

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-200">Fächer</div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
          >
            Aktualisieren
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-3 text-sm text-slate-400">Lade…</div>
        ) : subjects.length === 0 ? (
          <div className="mt-3 text-sm text-slate-400">
            Noch keine Fächer. Lege dein erstes Fach an (z.B. Mathe).
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

