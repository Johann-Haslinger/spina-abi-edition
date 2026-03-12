import { useMemo, useState } from 'react';
import { IoCheckmark } from 'react-icons/io5';
import { GhostButton, PrimaryButton } from '../../../../components/Button';
import type { AttemptResult } from '../../../../domain/models';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';
import { HighlightText, MutedText, PanelHeading } from './TextHighlight';

export function ReviewView(props: {
  gripProps: DragGripProps;
  onClose: () => void;
  onSave: (input: {
    result: AttemptResult;
    note?: string;
    errorType?: string;
  }) => Promise<void> | void;
}) {
  const [result, setResult] = useState<AttemptResult>('correct');
  const [note, setNote] = useState('');
  const [errorType, setErrorType] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const showError = useMemo(() => result !== 'correct', [result]);

  return (
    <div className="space-y-3 flex flex-col h-full">
      <PanelViewHeader
        left={
          <PanelHeading>
            <MutedText>Wie lief </MutedText>
            <br />
            <HighlightText>die Aufgabe?</HighlightText>
          </PanelHeading>
        }
      />

      <div className="flex px-2 mt-2 mb-3 justify-between w-full gap-2">
        <ResultChip active={result === 'correct'} label="✅" onClick={() => setResult('correct')} />
        <ResultChip active={result === 'partial'} label="🟨" onClick={() => setResult('partial')} />
        <ResultChip active={result === 'wrong'} label="❌" onClick={() => setResult('wrong')} />
      </div>

      {showError ? (
        <textarea
          value={errorType}
          onChange={(e) => setErrorType(e.target.value)}
          placeholder="Fehlergrund"
          className="mt-3 w-full text-sm outline-none placeholder:text-white/50 resize-none"
          rows={2}
        />
      ) : null}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notiz (optional)"
        className="mt-1 w-full text-sm outline-none placeholder:text-white/50 resize-none"
        rows={2}
      />

      {saveError ? (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          Speichern fehlgeschlagen: {saveError}
        </div>
      ) : null}

      <div className="flex mt-auto justify-end gap-2">
        <GhostButton onClick={props.onClose}>Abbrechen</GhostButton>
        <PrimaryButton
          onClick={async () => {
            setSaving(true);
            setSaveError(null);
            try {
              await props.onSave({
                result,
                note: note.trim() || undefined,
                errorType: showError ? errorType.trim() || undefined : undefined,
              });
            } catch (e) {
              setSaveError(e instanceof Error ? e.message : 'Fehler');
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          icon={<IoCheckmark />}
        />
      </div>
    </div>
  );
}

function ResultChip(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full  size-13 text-lg font-semibold text-slate-50 ${
        props.active ? 'border-white/40 border' : ''
      }`}
    >
      {props.label}
    </button>
  );
}
