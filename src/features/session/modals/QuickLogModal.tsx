import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal';
import type { AttemptResult } from '../../../domain/models';

export function QuickLogModal(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    result: AttemptResult;
    note?: string;
    errorType?: string;
  }) => Promise<void> | void;
}) {
  const [result, setResult] = useState<AttemptResult>('correct');
  const [note, setNote] = useState('');
  const [errorType, setErrorType] = useState('');
  const [saving, setSaving] = useState(false);

  const showError = useMemo(() => result !== 'correct', [result]);

  useEffect(() => {
    if (!props.open) return;
    setResult('correct');
    setNote('');
    setErrorType('');
  }, [props.open]);

  async function submit() {
    setSaving(true);
    try {
      await props.onSubmit({
        result,
        note: note.trim() || undefined,
        errorType: showError ? errorType.trim() || undefined : undefined,
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
            disabled={saving}
          >
            Speichern
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-xs font-semibold text-slate-300">Ergebnis</div>
        <div className="flex flex-wrap gap-2">
          <ResultChip
            active={result === 'correct'}
            label="✅"
            onClick={() => setResult('correct')}
          />
          <ResultChip
            active={result === 'partial'}
            label="🟨"
            onClick={() => setResult('partial')}
          />
          <ResultChip active={result === 'wrong'} label="❌" onClick={() => setResult('wrong')} />
        </div>

        {showError ? (
          <label className="block">
            <div className="text-xs font-semibold text-slate-300">Fehlergrund</div>
            <input
              value={errorType}
              onChange={(e) => setErrorType(e.target.value)}
              placeholder="z.B. Rechenfehler"
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </label>
        ) : null}

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Notiz (optional)</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="1 Satz…"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
        </label>
      </div>
    </Modal>
  );
}

function ResultChip(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        props.active
          ? 'rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50'
          : 'rounded-md bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-50'
      }
    >
      {props.label}
    </button>
  );
}
