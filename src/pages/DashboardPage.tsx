import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import type { Subject } from '../domain/models'
import { useSubjectsStore } from '../stores/subjectsStore'
import { subjectColorOptions } from '../ui/subjectColors'

export function DashboardPage() {
  const { subjects, loading, error, refresh, createSubject, updateSubject, deleteSubject } =
    useSubjectsStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const defaultColor = subjectColorOptions[0]?.hex ?? '#6366F1'

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [saving, setSaving] = useState(false)

  const modalTitle = useMemo(
    () => (editing ? 'Fach bearbeiten' : 'Fach anlegen'),
    [editing],
  )

  function openCreate() {
    setEditing(null)
    setName('')
    setColor(defaultColor)
    setModalOpen(true)
  }

  function openEdit(subject: Subject) {
    setEditing(subject)
    setName(subject.name)
    setColor(subject.color)
    setModalOpen(true)
  }

  async function onSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      if (editing) {
        await updateSubject(editing.id, { name: trimmed, color })
      } else {
        await createSubject({ name: trimmed, color })
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Starte mit Fächern und Themen. Danach kommen Assets/Uploads und
            Sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Fach anlegen
        </button>
      </div>

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
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {subjects.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <Link
                        to={`/subjects/${s.id}`}
                        className="truncate text-sm font-semibold text-slate-50 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Themen, Assets, Reviews kommen als nächstes.
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Fach „${s.name}“ wirklich löschen? (Themen/Assets werden mit gelöscht)`,
                          )
                        ) {
                          void deleteSubject(s.id)
                        }
                      }}
                      className="rounded-md p-2 text-rose-200 hover:bg-rose-950/50"
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={modalTitle}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
              disabled={saving || !name.trim()}
            >
              Speichern
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Mathe"
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Farbe</div>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            >
              {subjectColorOptions.map((opt) => (
                <option key={opt.id} value={opt.hex}>
                  {opt.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              Vorschau
            </div>
          </label>
        </div>
      </Modal>
    </div>
  )
}

