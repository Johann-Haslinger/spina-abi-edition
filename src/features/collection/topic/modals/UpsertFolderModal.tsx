import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Folder } from '../../../../domain/models';
import { flattenFoldersForSelect } from '../utils/folderSelect';

export function UpsertFolderModal(props: {
  open: boolean;
  mode: 'create' | 'edit';
  folders: Folder[];
  initial?: { name: string; iconEmoji?: string; parentFolderId?: string };
  onClose: () => void;
  onSave: (input: {
    name: string;
    iconEmoji?: string;
    parentFolderId?: string;
  }) => Promise<void> | void;
}) {
  const title = useMemo(
    () => (props.mode === 'edit' ? 'Folder bearbeiten' : 'Folder anlegen'),
    [props.mode],
  );

  const [name, setName] = useState('');
  const [iconEmoji, setIconEmoji] = useState('');
  const [parentId, setParentId] = useState<string | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setName(props.initial?.name ?? '');
    setIconEmoji(props.initial?.iconEmoji ?? '');
    setParentId(props.initial?.parentFolderId ?? '');
  }, [props.open, props.initial]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await props.onSave({
        name: trimmed,
        iconEmoji: iconEmoji.trim() || undefined,
        parentFolderId: parentId || undefined,
      });
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={props.open}
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
      {title}
      <div className="space-y-4">
        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Icon (Emoji)</div>
          <input
            value={iconEmoji}
            onChange={(e) => setIconEmoji(e.target.value)}
            placeholder="z.B. 📂"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. IQB 2022"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Parent</div>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          >
            <option value="">(Root)</option>
            {flattenFoldersForSelect(props.folders).map((f) => (
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
  );
}
