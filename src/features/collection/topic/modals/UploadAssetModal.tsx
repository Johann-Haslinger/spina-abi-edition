import { FileUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { AssetType, Folder } from '../../../../domain/models';
import { FilterChip } from '../components/FilterChip';
import { flattenFoldersForSelect } from '../utils/folderSelect';

export function UploadAssetModal(props: {
  open: boolean;
  file: File | null;
  initialType: AssetType;
  folders: Folder[];
  onClose: () => void;
  onSubmit: (input: {
    type: AssetType;
    title: string;
    folderId?: string;
    file: File;
  }) => Promise<void> | void;
}) {
  const [type, setType] = useState<AssetType>(props.initialType);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setType(props.initialType);
    const f = props.file;
    setTitle(f ? f.name.replace(/\.[^.]+$/, '') : '');
    setFolderId('');
  }, [props.open, props.initialType, props.file]);

  async function submit() {
    if (!props.file) return;
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      await props.onSubmit({
        type,
        title: t,
        folderId: folderId || undefined,
        file: props.file,
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
            disabled={saving || !props.file || !title.trim()}
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
            <span className="truncate">{props.file ? props.file.name : '—'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Typ</div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={type === 'exercise'}
              label="Übung"
              onClick={() => setType('exercise')}
            />
            <FilterChip
              active={type === 'cheatsheet'}
              label="Merkblatt"
              onClick={() => setType('cheatsheet')}
            />
            <FilterChip active={type === 'note'} label="Notiz" onClick={() => setType('note')} />
            <FilterChip active={type === 'file'} label="Datei" onClick={() => setType('file')} />
          </div>
        </div>

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Titel</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Folder</div>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          >
            <option value="">(Root)</option>
            {flattenFoldersForSelect(props.folders).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}
