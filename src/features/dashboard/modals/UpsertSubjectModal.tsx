import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../../components/Modal'
import { subjectColorOptions } from '../../../ui/subjectColors'

export function UpsertSubjectModal(props: {
  open: boolean
  mode: 'create' | 'edit'
  initial?: { name: string; color: string; iconEmoji?: string }
  onClose: () => void
  onSave: (input: { name: string; color: string; iconEmoji?: string }) => Promise<void> | void
}) {
  const defaultColor = subjectColorOptions[0]?.hex ?? '#6366F1'

  const title = useMemo(
    () => (props.mode === 'edit' ? 'Fach bearbeiten' : 'Fach anlegen'),
    [props.mode],
  )

  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [iconEmoji, setIconEmoji] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!props.open) return
    setName(props.initial?.name ?? '')
    setColor(props.initial?.color ?? defaultColor)
    setIconEmoji(props.initial?.iconEmoji ?? '')
  }, [props.open, props.initial, defaultColor])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await props.onSave({
        name: trimmed,
        color,
        iconEmoji: iconEmoji.trim() || undefined,
      })
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={props.open}
      title={title}
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            disabled={saving}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void submit()}
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
          <div className="text-xs font-semibold text-slate-300">Icon (Emoji)</div>
          <input
            value={iconEmoji}
            onChange={(e) => setIconEmoji(e.target.value)}
            placeholder="z.B. 📘"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
          <div className="mt-2 text-xs text-slate-400">
            Optional. Kurz halten (1–2 Emojis).
          </div>
        </label>

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
  )
}

