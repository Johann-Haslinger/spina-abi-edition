import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import type { SingleChoiceExercise as SingleChoiceExerciseType } from '../types';

export function SingleChoiceExercise(props: {
  exercise: SingleChoiceExerciseType;
  disabled?: boolean;
  onSubmit: (selectedOptionId: string) => void;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-4">
      <div className="text-xs uppercase tracking-wide text-cyan-100/60">Single Choice</div>
      <div className="mt-2 text-sm text-white">{props.exercise.prompt}</div>
      <div className="mt-4 space-y-2">
        {props.exercise.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          return (
            <SecondaryButton
              key={option.id}
              onClick={() => setSelectedOptionId(option.id)}
              disabled={props.disabled}
              className={`w-full justify-start rounded-2xl border px-4 py-3 text-left ${
                isSelected ? 'border-white/30 bg-white/12' : 'border-white/8 bg-white/5'
              }`}
            >
              {option.text}
            </SecondaryButton>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <PrimaryButton
          onClick={() => selectedOptionId && props.onSubmit(selectedOptionId)}
          disabled={props.disabled || !selectedOptionId}
        >
          Antwort senden
        </PrimaryButton>
      </div>
    </div>
  );
}
