import { FileUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GhostButton } from '../../../../components/Button';
import { Modal } from '../../../../components/Modal';
import type { ExerciseDifficulty, Folder } from '../../../../domain/models';
import { exerciseRepo } from '../../../../repositories';
import { invokeExerciseTitles } from '../../../session/ai/aiClient';
import { FilterChip } from '../components/FilterChip';
import { flattenFoldersForSelect } from '../utils/folderSelect';

type Row = {
  id: string;
  file: File;
  title: string;
  difficulty: ExerciseDifficulty;
};

const DIFF_LABEL: Record<ExerciseDifficulty, string> = {
  1: 'Leicht',
  2: 'Mittel',
  3: 'Schwer',
};

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function filesSignature(files: File[]): string {
  return files.map((f) => `${f.name}:${f.size}`).join('|');
}

export function BulkExerciseUploadModal(props: {
  open: boolean;
  files: File[];
  folders: Folder[];
  subjectId: string;
  topicId: string;
  onClose: () => void;
  onRequestPick: () => void;
  createWithFile: (input: {
    subjectId: string;
    topicId: string;
    folderId?: string;
    type: 'exercise';
    title: string;
    file: File;
  }) => Promise<{ id: string }>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [folderId, setFolderId] = useState<string | ''>('');
  const [namingInstruction, setNamingInstruction] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [titlesError, setTitlesError] = useState<string | null>(null);
  const [assignMode, setAssignMode] = useState<ExerciseDifficulty | null>(null);
  const [assignSelection, setAssignSelection] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const sig = useMemo(() => filesSignature(props.files), [props.files]);

  useEffect(() => {
    if (!props.open) {
      setFolderId('');
      setNamingInstruction('');
      setRows([]);
      setLoadingTitles(false);
      setTitlesError(null);
      setAssignMode(null);
      setAssignSelection(new Set());
    }
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    setRows([]);
    setLoadingTitles(false);
    setTitlesError(null);
    setAssignMode(null);
    setAssignSelection(new Set());
  }, [props.open, sig]);

  const showPicker = props.open && props.files.length === 0;
  const showGenerator = props.open && props.files.length > 0;
  const canGenerateTitles = props.files.length > 0 && !loadingTitles && !saving;

  const enterAssignMode = (difficulty: ExerciseDifficulty) => {
    setAssignMode(difficulty);
    setAssignSelection(new Set(rows.filter((r) => r.difficulty === difficulty).map((r) => r.id)));
  };

  const finishAssignMode = () => {
    if (assignMode == null) return;
    const selectedDifficulty = assignMode;
    setRows((prev) =>
      prev.map((row) =>
        assignSelection.has(row.id) ? { ...row, difficulty: selectedDifficulty } : row,
      ),
    );
    setAssignMode(null);
    setAssignSelection(new Set());
  };

  const toggleAssignRow = (id: string) => {
    setAssignSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllForAssign = () => {
    setAssignSelection(new Set(rows.map((r) => r.id)));
  };

  const generateTitles = async () => {
    if (!canGenerateTitles) return;
    setLoadingTitles(true);
    setTitlesError(null);
    try {
      const { titles } = await invokeExerciseTitles({
        fileNames: props.files.map((f) => f.name),
        namingInstruction,
      });
      const previousDifficulty = new Map(rows.map((row) => [row.id, row.difficulty] as const));
      setRows(
        props.files.map((file, index) => {
          const id = `${file.name}-${file.size}-${index}`;
          return {
            id,
            file,
            title: titles[index] ?? stripExtension(file.name),
            difficulty: previousDifficulty.get(id) ?? 2,
          };
        }),
      );
      setAssignMode(null);
      setAssignSelection(new Set());
    } catch (error) {
      setTitlesError(error instanceof Error ? error.message : 'Titel konnten nicht geladen werden');
      props.onError(error instanceof Error ? error.message : 'Titel-Vorschlag fehlgeschlagen');
    } finally {
      setLoadingTitles(false);
    }
  };

  const submit = async () => {
    if (assignMode != null || saving || loadingTitles || rows.length === 0) return;
    if (rows.some((row) => !row.title.trim())) {
      props.onError('Bitte alle Titel ausfüllen.');
      return;
    }

    setSaving(true);
    try {
      for (const row of rows) {
        const asset = await props.createWithFile({
          subjectId: props.subjectId,
          topicId: props.topicId,
          folderId: folderId || undefined,
          type: 'exercise',
          title: row.title.trim(),
          file: row.file,
        });
        await exerciseRepo.setDifficultyByAsset(asset.id, row.difficulty);
      }
      props.onSuccess(
        rows.length === 1 ? 'Übung hinzugefügt' : `${rows.length} Übungen hinzugefügt`,
      );
      props.onClose();
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Upload fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    props.onClose();
  };

  return (
    <Modal
      open={props.open}
      onClose={handleClose}
      footer={
        <>
          <GhostButton onClick={handleClose} disabled={saving || loadingTitles}>
            Abbrechen
          </GhostButton>
          {showPicker ? (
            <button
              type="button"
              onClick={props.onRequestPick}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
            >
              Dateien wählen
            </button>
          ) : assignMode != null ? (
            <button
              type="button"
              onClick={finishAssignMode}
              disabled={saving || loadingTitles}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Fertig
            </button>
          ) : rows.length === 0 ? (
            <button
              type="button"
              onClick={() => void generateTitles()}
              disabled={!canGenerateTitles}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {loadingTitles ? 'Generiere…' : 'Namen generieren'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || loadingTitles || rows.some((row) => !row.title.trim())}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {saving ? 'Speichere…' : 'Aufgaben hinzufügen'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5 text-sm text-slate-300">
        <div className="rounded-3xl border border-white/10 bg-linear-to-br from-indigo-500/20 via-slate-900 to-slate-950 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Bulk-Upload für Übungen</div>
              <p className="mt-1 text-sm text-slate-300">
                Wähle Dateien, beschreibe kurz dein gewünschtes Benennungsschema und generiere dann
                alle Titel gesammelt mit genau einem KI-Call.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Dateien</div>
              <div className="text-base font-semibold text-white">{props.files.length}</div>
            </div>
          </div>
        </div>

        {showPicker ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/3 px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
              <FileUp className="h-6 w-6" />
            </div>
            <div className="mt-4 text-base font-medium text-white">
              Mehrere PDFs auf einmal hochladen
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Danach kannst du zuerst angeben, wie die Übungen benannt werden sollen.
            </p>
          </div>
        ) : null}

        {showGenerator ? (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">1. Dateien auswählen</div>
                  <div className="text-xs text-slate-400">
                    Aktuell ausgewählt: {props.files.length} Datei
                    {props.files.length === 1 ? '' : 'en'}
                  </div>
                </div>
                <GhostButton onClick={props.onRequestPick} disabled={saving || loadingTitles}>
                  Dateien ändern
                </GhostButton>
              </div>
              <div className="mt-3 max-h-28 space-y-2 overflow-y-auto pr-1">
                {props.files.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/60 px-3 py-2 text-xs text-slate-300"
                  >
                    <FileUp className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
              <div className="text-sm font-semibold text-white">
                2. Wie soll ich die Übungen benennen?
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Beispiel: "Kurz, einheitlich und immer mit Thema + Aufgabentyp", oder "So wie im
                Skript, aber lesbarer".
              </p>
              <textarea
                value={namingInstruction}
                onChange={(e) => setNamingInstruction(e.target.value)}
                disabled={saving || loadingTitles}
                rows={3}
                placeholder="z. B. Thema zuerst, dann Teilgebiet, dann ggf. CAS oder ohne Nummern"
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-50 outline-none ring-indigo-500/30 placeholder:text-slate-500 focus:ring-2 disabled:opacity-50"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Die Eingabe wird zusammen mit allen Dateinamen in einem einzigen
                  Edge-Function-Call verwendet.
                </div>
                <button
                  type="button"
                  onClick={() => void generateTitles()}
                  disabled={!canGenerateTitles}
                  className="rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-3 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                >
                  {loadingTitles
                    ? 'Generiere…'
                    : rows.length > 0
                      ? 'Namen neu generieren'
                      : 'Namen generieren'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {showGenerator && loadingTitles ? (
          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-4 text-indigo-100">
            Generiere einheitliche Titel für alle ausgewählten Übungen…
          </div>
        ) : null}

        {showGenerator && titlesError ? (
          <div className="rounded-3xl border border-amber-900/50 bg-amber-950/20 px-4 py-4 text-amber-100">
            {titlesError}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
              <label className="block">
                <div className="text-sm font-semibold text-white">Ordner für alle Dateien</div>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  disabled={saving || assignMode != null}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2 disabled:opacity-50"
                >
                  <option value="">(Root)</option>
                  {flattenFoldersForSelect(props.folders).map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
              <div className="text-sm font-semibold text-white">3. Schwierigkeit zuweisen</div>
              <p className="mt-1 text-xs text-slate-400">
                Wähle eine Schwierigkeit, hake passende Aufgaben an und bestätige mit "Fertig".
                Standard ist Mittel.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {([1, 2, 3] as const).map((difficulty) => (
                  <FilterChip
                    key={difficulty}
                    active={assignMode === difficulty}
                    label={DIFF_LABEL[difficulty]}
                    onClick={() => {
                      if (saving || loadingTitles) return;
                      if (assignMode === difficulty) {
                        setAssignMode(null);
                        setAssignSelection(new Set());
                        return;
                      }
                      enterAssignMode(difficulty);
                    }}
                  />
                ))}
                {assignMode != null ? (
                  <button
                    type="button"
                    onClick={selectAllForAssign}
                    disabled={saving || loadingTitles}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Alle auswählen
                  </button>
                ) : null}
              </div>
              {assignMode != null ? (
                <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                  Aktiver Modus: {DIFF_LABEL[assignMode]}
                </div>
              ) : null}
            </div>

            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900 to-slate-950 px-4 py-4 shadow-lg shadow-black/10"
                >
                  <div className="flex items-start gap-3">
                    {assignMode != null ? (
                      <input
                        type="checkbox"
                        checked={assignSelection.has(row.id)}
                        onChange={() => toggleAssignRow(row.id)}
                        className="mt-2 h-4 w-4 shrink-0 rounded border-slate-600"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <FileUp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{row.file.name}</span>
                      </div>
                      <input
                        value={row.title}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((entry) =>
                              entry.id === row.id ? { ...entry, title: e.target.value } : entry,
                            ),
                          )
                        }
                        disabled={saving || assignMode != null}
                        placeholder="Titel"
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2 disabled:opacity-50"
                      />
                      <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        Schwierigkeit: {DIFF_LABEL[row.difficulty]}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
