import { useMemo, useState } from 'react';
import { PrimaryButton } from '../../../../../components/Button';
import type { MatchingExercise as MatchingExerciseType } from '../types';

export function MatchingExercise(props: {
  exercise: MatchingExerciseType;
  disabled?: boolean;
  onSubmit: (pairs: { leftId: string; rightId: string }[]) => void;
}) {
  const initialAssignments = useMemo(
    () => Object.fromEntries(props.exercise.leftItems.map((item) => [item.id, ''])),
    [props.exercise.leftItems],
  );
  const [assignments, setAssignments] = useState<Record<string, string>>(initialAssignments);

  const allAssigned = props.exercise.leftItems.every((item) => assignments[item.id]);

  return (
    <div className="rounded-3xl border border-violet-400/20 bg-violet-500/5 p-4">
      <div className="text-xs uppercase tracking-wide text-violet-100/60">Matching</div>
      <div className="mt-2 text-sm text-white">{props.exercise.prompt}</div>
      <div className="mt-4 space-y-3">
        {props.exercise.leftItems.map((leftItem) => (
          <label
            key={leftItem.id}
            className="grid gap-2 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 md:grid-cols-[minmax(0,1fr)_180px]"
          >
            <span className="text-sm text-white">{leftItem.text}</span>
            <select
              value={assignments[leftItem.id] ?? ''}
              disabled={props.disabled}
              onChange={(event) =>
                setAssignments((current) => ({
                  ...current,
                  [leftItem.id]: event.target.value,
                }))
              }
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">Zuordnen…</option>
              {props.exercise.rightItems.map((rightItem) => (
                <option key={rightItem.id} value={rightItem.id}>
                  {rightItem.text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <PrimaryButton
          onClick={() =>
            props.onSubmit(
              props.exercise.leftItems.map((item) => ({
                leftId: item.id,
                rightId: assignments[item.id],
              })),
            )
          }
          disabled={props.disabled || !allAssigned}
        >
          Zuordnung senden
        </PrimaryButton>
      </div>
    </div>
  );
}
