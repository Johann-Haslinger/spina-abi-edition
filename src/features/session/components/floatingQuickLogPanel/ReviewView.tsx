import { Check, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AttemptResult } from '../../../../domain/models'

export function ReviewView(props: {
  seconds: number
  onClose: () => void
  onSave: (input: { result: AttemptResult; note?: string; errorType?: string }) => Promise<void> | void
}) {
  const [result, setResult] = useState<AttemptResult>('correct')
  const [note, setNote] = useState('')
  const [errorType, setErrorType] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const showError = useMemo(() => result !== 'correct', [result])

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-300">Review</div>
          <div className="mt-0.5 text-xs text-slate-400">
            Zeit: {formatDuration(props.seconds)}
          </div>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <ResultChip active={result === 'correct'} label="✅" onClick={() => setResult('correct')} />
        <ResultChip active={result === 'partial'} label="🟨" onClick={() => setResult('partial')} />
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

      {saveError ? (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          Speichern fehlgeschlagen: {saveError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            setSaving(true)
            setSaveError(null)
            try {
              await props.onSave({
                result,
                note: note.trim() || undefined,
                errorType: showError ? errorType.trim() || undefined : undefined,
              })
            } catch (e) {
              setSaveError(e instanceof Error ? e.message : 'Fehler')
            } finally {
              setSaving(false)
            }
          }}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          disabled={saving}
        >
          <Check className="h-4 w-4" />
          Speichern
        </button>

        <button
          type="button"
          onClick={props.onClose}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
          disabled={saving}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
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
  )
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
