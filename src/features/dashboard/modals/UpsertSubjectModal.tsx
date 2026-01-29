import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal';
import type { Subject } from '../../../domain/models';
import { useSubjectAccentColor } from '../../../ui/hooks/useSubjectColors';
import { DEFAULT_SUBJECT_COLOR, subjectColorOptions } from '../../../ui/subjectColors';

export function UpsertSubjectModal(props: {
  open: boolean;
  mode: 'create' | 'edit';
  subject?: Subject;
  initial?: { name: string; color: Subject['color']; iconEmoji?: string };
  onClose: () => void;
  onSave: (input: {
    name: string;
    color: Subject['color'];
    iconEmoji?: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const defaultColor = DEFAULT_SUBJECT_COLOR;

  const title = useMemo(
    () => (props.mode === 'edit' ? 'Fach bearbeiten' : 'Fach anlegen'),
    [props.mode],
  );

  const [name, setName] = useState('');
  const [color, setColor] = useState<Subject['color']>(defaultColor);
  const [iconEmoji, setIconEmoji] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const accentColor = useSubjectAccentColor(props.subject);

  useEffect(() => {
    if (!props.open) return;
    setName(props.initial?.name ?? '');
    setColor(props.initial?.color ?? defaultColor);
    setIconEmoji(props.initial?.iconEmoji ?? '');
  }, [props.open, props.initial, defaultColor]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await props.onSave({
        name: trimmed,
        color,
        iconEmoji: iconEmoji.trim() || undefined,
      });
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject() {
    if (props.mode !== 'edit' || !props.onDelete) return;
    const subjectName = props.subject?.name ?? (name.trim() || 'dieses Fach');
    if (
      !window.confirm(`Fach „${subjectName}“ wirklich löschen? (Themen/Assets werden mit gelöscht)`)
    )
      return;

    setDeleting(true);
    try {
      await props.onDelete();
      props.onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={props.open}
      title={title}
      onClose={props.onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {props.mode === 'edit' && props.onDelete ? (
            <button
              type="button"
              onClick={() => void deleteSubject()}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              disabled={saving || deleting}
            >
              Löschen
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
              disabled={saving || deleting}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
              disabled={saving || deleting || !name.trim()}
            >
              Speichern
            </button>
          </div>
        </div>
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
          <div className="mt-2 text-xs text-slate-400">Optional. Kurz halten (1–2 Emojis).</div>
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
          <div className="mt-1 grid grid-cols-1 gap-3">
            <select
              value={color.colorId}
              onChange={(e) =>
                setColor((c) => ({
                  ...c,
                  colorId: e.target.value as Subject['color']['colorId'],
                }))
              }
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            >
              {subjectColorOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                backgroundColor: accentColor,
              }}
              aria-hidden
            />
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[11px]"
              style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
            >
              Aa
            </span>
            Vorschau
          </div>
        </label>
      </div>
    </Modal>
  );
}
