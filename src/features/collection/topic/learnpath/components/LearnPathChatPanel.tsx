import { ChatInputRow } from '../../../../../components/chat/ChatInputRow';
import { ChatMessage } from '../../../../../components/chat/ChatMessage';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import { getPlanStepPosition } from '../learnPathUtils';
import type {
  LearnPathExercise,
  LearnPathMessage,
  LearnPathState,
  LearnPathTurnResponse,
  RequirementPlan,
  RequirementPlanStep,
} from '../types';
import { FreeTextExercise } from './FreeTextExercise';
import { LearnPathThinkingCard } from './LearnPathThinkingCard';
import { MatchingExercise } from './MatchingExercise';
import { SingleChoiceExercise } from './SingleChoiceExercise';

export function LearnPathChatPanel(props: {
  state: LearnPathState;
  mode: 'learn' | 'review' | null;
  draft: string;
  totalChapters: number;
  totalRequirements: number;
  currentRequirementPosition: number;
  currentChapterName?: string;
  currentRequirementName?: string;
  activePlan: RequirementPlan | null;
  activeStep?: RequirementPlanStep;
  onDraftChange: (value: string) => void;
  onBack: () => void;
  onRestart: () => void;
  onContinue: () => void;
  onSend: () => void;
  onExerciseSubmit: (response: LearnPathTurnResponse, exercise: LearnPathExercise | null) => void;
}) {
  const {
    state,
    mode,
    draft,
    totalChapters,
    totalRequirements,
    currentRequirementPosition,
    currentChapterName,
    currentRequirementName,
    activePlan,
    activeStep,
  } = props;
  const currentStepPosition = getPlanStepPosition(activePlan, state.activeStepId);
  const isMissingExerciseFallback =
    state.waitingForUser &&
    !state.pendingExercise &&
    (state.inputMode === 'single_choice' ||
      state.inputMode === 'matching' ||
      state.inputMode === 'free_text');
  const canUseTextInput =
    state.waitingForUser &&
    !state.pendingExercise &&
    (state.inputMode === 'text' ||
      state.inputMode === 'free_text' ||
      state.inputMode === 'single_choice' ||
      state.inputMode === 'matching');

  return (
    <div className="rounded-3xl border border-white/8 bg-slate-950/25">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <div className="text-xl font-semibold text-white">Wissenspfad</div>
          <div className="mt-2 text-sm text-white/65">
            {mode ? `${mode === 'learn' ? 'Lernmodus' : 'Wiederholmodus'} · ` : ''}
            Kapitel {state.currentChapterIndex + 1} von {totalChapters}
            {' · '}
            Requirement {currentRequirementPosition} von {totalRequirements}
            {activePlan ? (
              <>
                {' · '}
                Schritt {currentStepPosition} von {activePlan.steps.length}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={props.onBack} disabled={state.loading}>
            Zur Übersicht
          </SecondaryButton>
          <SecondaryButton onClick={props.onRestart} disabled={state.loading}>
            Neu starten
          </SecondaryButton>
        </div>
      </div>

      <div className="border-b border-white/8 px-5 py-4">
        <div className="text-xs uppercase tracking-wide text-white/45">Aktiver Schritt</div>
        <div className="mt-1 text-lg font-semibold text-white">
          {currentChapterName ?? 'Kapitel'}
          {' · '}
          {currentRequirementName ?? 'Requirement'}
        </div>
        <div className="mt-2 text-sm text-white/70">
          {activeStep ? (
            <>
              <span className="text-white">{activeStep.title}</span>
              {' · '}
              {activeStep.type}
              {activeStep.exerciseType ? ` · ${activeStep.exerciseType}` : ''}
            </>
          ) : (
            'Fahrplan wird erstellt…'
          )}
        </div>
      </div>

      <div className="max-h-[58vh] space-y-4 overflow-y-auto px-5 py-5">
        {state.messages.map((message) => (
          <LearnPathChatMessage key={message.id} message={message} />
        ))}
        {state.loading ? <LearnPathThinkingCard /> : null}
        {state.error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/8 px-5 py-4">
        {state.pathCompleted ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/75">
              Alle Requirements im Wissenspfad wurden abgeschlossen.
            </div>
            <PrimaryButton onClick={props.onRestart}>Erneut starten</PrimaryButton>
          </div>
        ) : state.waitingForUser && state.pendingExercise?.type === 'single_choice' ? (
          <SingleChoiceExercise
            key={`${state.activeStepId ?? 'exercise'}-single_choice`}
            exercise={state.pendingExercise}
            disabled={state.loading}
            onSubmit={(selectedOptionId) =>
              props.onExerciseSubmit(
                { kind: 'single_choice', selectedOptionId },
                state.pendingExercise,
              )
            }
          />
        ) : state.waitingForUser && state.pendingExercise?.type === 'matching' ? (
          <MatchingExercise
            key={`${state.activeStepId ?? 'exercise'}-matching`}
            exercise={state.pendingExercise}
            disabled={state.loading}
            onSubmit={(pairs) =>
              props.onExerciseSubmit({ kind: 'matching', pairs }, state.pendingExercise)
            }
          />
        ) : state.waitingForUser && state.pendingExercise?.type === 'free_text' ? (
          <FreeTextExercise
            key={`${state.activeStepId ?? 'exercise'}-free_text`}
            exercise={state.pendingExercise}
            disabled={state.loading}
            onSubmit={(text) =>
              props.onExerciseSubmit({ kind: 'free_text', text }, state.pendingExercise)
            }
          />
        ) : state.canContinue ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Die KI hat den naechsten Schritt vorbereitet. Mit einem Klick geht es weiter.
            </div>
            <PrimaryButton onClick={props.onContinue} disabled={state.loading}>
              Weiter
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-3">
            <ChatInputRow
              value={draft}
              onChange={props.onDraftChange}
              onSubmit={props.onSend}
              sending={state.loading}
              placeholder={
                state.waitingForUser
                  ? isMissingExerciseFallback
                    ? 'Die Übung wurde nicht geladen. Antworte hier einfach per Text…'
                    : state.inputMode === 'free_text'
                      ? 'Schreibe deine Antwort auf die Aufgabe…'
                      : 'Antworte kurz auf die Verstaendnisfrage…'
                  : 'Antworten werden freigeschaltet, sobald der aktuelle Schritt Textinput erwartet.'
              }
              disabled={!canUseTextInput || state.loading}
            />
            {isMissingExerciseFallback ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Die erwartete Übung wurde gerade nicht geladen. Du kannst trotzdem per Text
                antworten, damit der Lernfluss nicht blockiert.
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/45">
                {state.waitingForUser
                  ? isMissingExerciseFallback
                    ? 'Fallback aktiv: Antwort per Text ist freigeschaltet.'
                    : 'Die KI wartet auf deine Antwort.'
                  : 'Die KI steuert den Fahrplan aktuell selbst.'}
              </div>
              <PrimaryButton
                onClick={props.onSend}
                disabled={
                  !canUseTextInput ||
                  state.loading ||
                  !draft.trim()
                }
              >
                Antworten
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LearnPathChatMessage(props: { message: LearnPathMessage }) {
  const { message } = props;
  if (message.role === 'system') {
    return (
      <ChatMessage
        align="center"
        bubbleClassName="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/65"
      >
        {message.content}
      </ChatMessage>
    );
  }

  const isUser = message.role === 'user';
  return (
    <ChatMessage
      align={isUser ? 'end' : 'start'}
      bubbleClassName={`max-w-[85%] rounded-3xl px-4 py-3 ${
        isUser ? 'bg-white/10 text-white' : 'border border-white/8 bg-[#243957]/50 text-white'
      }`}
    >
      <div className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</div>
      {!isUser ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
          {message.messageKind ? (
            <span className="rounded-full border border-white/10 px-2 py-1">
              {message.messageKind}
            </span>
          ) : null}
          {message.stepType ? (
            <span className="rounded-full border border-white/10 px-2 py-1">{message.stepType}</span>
          ) : null}
          {message.exercise?.type ? (
            <span className="rounded-full border border-white/10 px-2 py-1">
              {message.exercise.type}
            </span>
          ) : null}
        </div>
      ) : null}
    </ChatMessage>
  );
}
