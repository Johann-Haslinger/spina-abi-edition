import { useState } from 'react';
import { PrimaryButton } from '../../../../../components/Button';
import type { FreeTextExercise as FreeTextExerciseType } from '../types';

export function FreeTextExercise(props: {
  exercise: FreeTextExerciseType;
  disabled?: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <div className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-4">
      <div className="text-xs uppercase tracking-wide text-amber-100/60">Freitext</div>
      <div className="mt-2 text-sm text-white">{props.exercise.prompt}</div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={props.disabled}
        placeholder={props.exercise.placeholder ?? 'Schreibe deine Antwort hier…'}
        className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
      />
      <div className="mt-4 flex justify-end">
        <PrimaryButton
          onClick={() => props.onSubmit(value.trim())}
          disabled={props.disabled || !value.trim()}
        >
          Antwort senden
        </PrimaryButton>
      </div>
    </div>
  );
}
