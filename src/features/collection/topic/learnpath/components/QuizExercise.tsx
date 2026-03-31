import { useMemo, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import type { QuizExercise as QuizExerciseType } from '../types';

export function QuizExercise(props: {
  exercise: QuizExerciseType;
  disabled?: boolean;
  onSubmit: (answers: { questionId: string; selectedOptionId: string }[]) => void;
}) {
  const initialAnswers = useMemo(
    () => Object.fromEntries(props.exercise.questions.map((question) => [question.id, ''])),
    [props.exercise.questions],
  );
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const allAnswered = props.exercise.questions.every((question) => answers[question.id]);

  return (
    <div className="rounded-[28px] border border-cyan-400/20 bg-cyan-500/8 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/60">Quiz</div>
      <div className="mt-2 text-sm text-white/85">{props.exercise.prompt}</div>
      <div className="mt-4 space-y-4">
        {props.exercise.questions.map((question, index) => (
          <div key={question.id} className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Frage {index + 1}</div>
            <div className="mt-2 text-base text-white">{question.prompt}</div>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => {
                const isSelected = answers[question.id] === option.id;
                return (
                  <SecondaryButton
                    key={option.id}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option.id,
                      }))
                    }
                    disabled={props.disabled}
                    className={`w-full justify-start rounded-2xl border px-4 py-3 text-left ${
                      isSelected ? 'border-cyan-300/40 bg-cyan-400/10' : 'border-white/8 bg-white/5'
                    }`}
                  >
                    {option.text}
                  </SecondaryButton>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <PrimaryButton
          onClick={() =>
            props.onSubmit(
              props.exercise.questions.map((question) => ({
                questionId: question.id,
                selectedOptionId: answers[question.id],
              })),
            )
          }
          disabled={props.disabled || !allAnswered}
        >
          Quiz senden
        </PrimaryButton>
      </div>
    </div>
  );
}
