import type { LearnPathExercise, LearnPathTurnResponse } from '../types';
import { FreeTextExercise } from './FreeTextExercise';
import { MatchingExercise } from './MatchingExercise';
import { QuizExercise } from './QuizExercise';

export function LearnPathExerciseRenderer(props: {
  exercise: LearnPathExercise;
  subjectId?: string;
  disabled?: boolean;
  onSubmit: (response: LearnPathTurnResponse, exercise: LearnPathExercise) => void;
}) {
  if (props.exercise.type === 'quiz') {
    return (
      <QuizExercise
        exercise={props.exercise}
        subjectId={props.subjectId}
        disabled={props.disabled}
        onSubmit={(payload) =>
          props.onSubmit(
            { kind: 'quiz', answers: payload.answers, summary: payload.summary },
            props.exercise,
          )
        }
      />
    );
  }

  if (props.exercise.type === 'matching') {
    return (
      <MatchingExercise
        exercise={props.exercise}
        disabled={props.disabled}
        onSubmit={(pairs) => props.onSubmit({ kind: 'matching', pairs }, props.exercise)}
      />
    );
  }

  return (
    <FreeTextExercise
      exercise={props.exercise}
      disabled={props.disabled}
      onSubmit={(text) => props.onSubmit({ kind: 'free_text', text }, props.exercise)}
    />
  );
}
