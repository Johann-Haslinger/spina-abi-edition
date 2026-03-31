import { useMemo, useState } from 'react';
import { GhostButton, PrimaryButton } from '../../../../../components/Button';
import type { QuizExercise as QuizExerciseType } from '../types';

export function QuizExercise(props: {
  exercise: QuizExerciseType;
  subjectId?: string;
  disabled?: boolean;
  onSubmit: (payload: {
    answers: { questionId: string; selectedOptionId: string }[];
    summary: { score: number; total: number; incorrectQuestionIds: string[] };
  }) => void;
}) {
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(props.exercise.questions.map((question) => [question.id, ''])) as Record<
        string,
        string
      >,
  );
  const [revealedByQuestionId, setRevealedByQuestionId] = useState<Record<string, boolean>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const totalQuestions = props.exercise.questions.length;
  const currentQuestion = props.exercise.questions[currentQuestionIndex];

  const answeredCount = props.exercise.questions.filter(
    (question) => revealedByQuestionId[question.id],
  ).length;

  const allAnswered = answeredCount === totalQuestions;
  const optionLabelByIndex = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);
  const score = props.exercise.questions.reduce((count, question) => {
    const selected = answersByQuestionId[question.id];
    return selected && selected === question.correctOptionId ? count + 1 : count;
  }, 0);
  const incorrectQuestionIds = props.exercise.questions
    .filter((question) => answersByQuestionId[question.id] !== question.correctOptionId)
    .map((question) => question.id);

  const submitPayload = () => {
    props.onSubmit({
      answers: props.exercise.questions.map((question) => ({
        questionId: question.id,
        selectedOptionId: answersByQuestionId[question.id],
      })),
      summary: {
        score,
        total: totalQuestions,
        incorrectQuestionIds,
      },
    });
  };

  const handleOptionSelect = (optionId: string) => {
    if (props.disabled || !currentQuestion) return;
    if (revealedByQuestionId[currentQuestion.id]) return;
    setAnswersByQuestionId((current) => ({
      ...current,
      [currentQuestion.id]: optionId,
    }));
    setRevealedByQuestionId((current) => ({
      ...current,
      [currentQuestion.id]: true,
    }));
  };

  const handleBackQuestion = () => {
    setCurrentQuestionIndex((index) => Math.max(0, index - 1));
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex((index) => Math.min(totalQuestions - 1, index + 1));
  };

  return (
    <div className="rounded-[28px] border border-white/5 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      {currentQuestion ? (
        <div>
          <div className="mt-2 text-base text-white">
            {currentQuestionIndex + 1}. {currentQuestion.prompt}
          </div>
          <div className="mt-6 grid gap-2">
            {currentQuestion.options.map((option, optionIndex) => {
              const selectedOptionId = answersByQuestionId[currentQuestion.id];
              const revealed = Boolean(revealedByQuestionId[currentQuestion.id]);
              const isSelected = selectedOptionId === option.id;
              const isCorrectOption = option.id === currentQuestion.correctOptionId;
              const selectedWasWrong =
                revealed &&
                selectedOptionId.length > 0 &&
                selectedOptionId !== currentQuestion.correctOptionId;
              const isWrongSelected = revealed && isSelected && !isCorrectOption;
              const isRightSelected = revealed && isSelected && isCorrectOption;
              const showCorrectOutline = revealed && isCorrectOption;
              const showOptionFeedback =
                revealed && (isSelected || (selectedWasWrong && isCorrectOption));
              const feedbackTitle = isCorrectOption
                ? '✅\u00A0\u00A0 Das stimmt.'
                : '❌\u00A0\u00A0Das ist falsch.';
              const feedbackText = isCorrectOption
                ? (option.feedback ??
                  currentQuestion.explanation ??
                  'Das ist die richtige Antwort.')
                : (option.feedback ?? 'Das war nicht korrekt.');
              const baseClass = 'w-full rounded-2xl border px-4 py-3 text-left transition-colors';
              const stateClass = isRightSelected
                ? 'border-[#34C759]/50 bg-[#34C759]/10'
                : isWrongSelected
                  ? 'border-[#FF3B30]/25 bg-[#FF3B30]/5'
                  : showCorrectOutline
                    ? 'border-[#34C759]/40 bg-[#34C759]/10'
                    : isSelected
                      ? 'border-cyan-300/60 bg-cyan-400/10'
                      : 'border-none bg-white/4 hover:bg-white/10';
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={props.disabled || revealed}
                  onClick={() => handleOptionSelect(option.id)}
                  className={`${baseClass} ${stateClass} disabled:cursor-default`}
                >
                  <div className="text-sm text-white">
                    <span className="mr-2 text-white/65">
                      {optionLabelByIndex[optionIndex] ?? `${optionIndex + 1}.`}.
                    </span>
                    {option.text}
                  </div>
                  {showOptionFeedback ? (
                    <div className="mt-4 text-sm">
                      <div
                        className={`font-semibold ${isCorrectOption ? 'text-[#34C759]/90' : 'text-[#FF3B30]/90'}`}
                      >
                        {feedbackTitle}
                      </div>
                      <div className="mt-1 ml-6 text-white/80">{feedbackText}</div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex items-end justify-between gap-2">
            <div className="text-sm text-white/50">
              {currentQuestionIndex + 1}/{totalQuestions}
            </div>
            <div className="flex items-center gap-2">
              <GhostButton
                onClick={handleBackQuestion}
                disabled={props.disabled || currentQuestionIndex === 0}
              >
                Zurück
              </GhostButton>
              <PrimaryButton
                onClick={handleNextQuestion}
                disabled={props.disabled || currentQuestionIndex === totalQuestions - 1}
              >
                Weiter
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
      {allAnswered ? (
        <div className="mt-4 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4">
          <div className="text-sm text-emerald-100">
            Quiz abgeschlossen: {score} / {totalQuestions} richtig.
          </div>
          {incorrectQuestionIds.length > 0 ? (
            <div className="mt-3 space-y-2 text-sm text-white/85">
              {props.exercise.questions
                .filter((question) => incorrectQuestionIds.includes(question.id))
                .map((question) => (
                  <div
                    key={question.id}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="text-white/90">{question.prompt}</div>
                    <div className="mt-1 text-emerald-200">
                      Richtige Antwort:{' '}
                      {
                        question.options.find((option) => option.id === question.correctOptionId)
                          ?.text
                      }
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-emerald-100">
              Stark - alle Fragen korrekt beantwortet.
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <PrimaryButton onClick={submitPayload} disabled={props.disabled}>
              Zusammenfassung senden
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
