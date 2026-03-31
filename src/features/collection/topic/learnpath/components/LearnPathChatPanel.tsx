import { LayoutGrid, RotateCcw } from 'lucide-react';
import { ChatInputRow } from '../../../../../components/chat/ChatInputRow';
import { ChatMarkdownContent } from '../../../../../components/chat/ChatMarkdownContent';
import { ChatMessage } from '../../../../../components/chat/ChatMessage';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import type { LearnPathMode } from '../../../../../domain/models';
import { getPlanStepPosition } from '../learnPathUtils';
import type {
  LearnPathMessage,
  LearnPathPanelView,
  LearnPathRequirementOverviewItem,
  LearnPathState,
  LearnPathTurnResponse,
  RequirementPlan,
  RequirementPlanStep,
} from '../types';
import { LearnPathExerciseRenderer } from './LearnPathExerciseRenderer';
import { LearnPathOverviewPanel } from './LearnPathOverviewPanel';
import { LearnPathThinkingCard } from './LearnPathThinkingCard';

export function LearnPathChatPanel(props: {
  state: LearnPathState;
  mode: LearnPathMode | null;
  draft: string;
  totalChapters: number;
  totalRequirements: number;
  currentRequirementPosition: number;
  subjectName?: string;
  topicName?: string;
  currentChapterName?: string;
  currentRequirementName?: string;
  activePlan: RequirementPlan | null;
  activeStep?: RequirementPlanStep;
  overviewItems: LearnPathRequirementOverviewItem[];
  onDraftChange: (value: string) => void;
  onBack: () => void;
  onRestart: () => void;
  onContinue: () => void;
  onSend: () => void;
  onExerciseSubmit: (response: LearnPathTurnResponse, exercise: LearnPathState['pendingExercise']) => void;
  onStartRequirement: (item: LearnPathRequirementOverviewItem, mode: LearnPathMode) => void;
  onPanelOpenChange: (open: boolean) => void;
  onPanelViewChange: (view: LearnPathPanelView) => void;
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
    (state.inputMode === 'quiz' ||
      state.inputMode === 'matching' ||
      state.inputMode === 'free_text');
  const canUseTextInput =
    state.waitingForUser &&
    !state.pendingExercise &&
    (state.inputMode === 'text' ||
      state.inputMode === 'free_text' ||
      state.inputMode === 'quiz' ||
      state.inputMode === 'matching');

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/8 bg-slate-950/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_35%)]" />
      <div className="relative flex min-h-[78vh] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Wissenspfad</div>
            <div className="mt-2 text-2xl font-semibold text-white">{currentRequirementName ?? 'Requirement'}</div>
            <div className="mt-2 text-sm text-white/60">
              {[props.topicName, currentChapterName].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-1 text-sm text-white/50">
              {mode ? `${mode === 'learn' ? 'Lernmodus' : 'Wiederholmodus'} · ` : ''}
              Requirement {currentRequirementPosition} von {totalRequirements}
              {' · '}
              Kapitel {state.currentChapterIndex + 1} von {totalChapters}
              {activePlan ? ` · Schritt ${currentStepPosition} von ${activePlan.steps.length}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={props.onBack} disabled={state.loading}>
              Zur Übersicht
            </SecondaryButton>
            <SecondaryButton onClick={props.onRestart} disabled={state.loading} icon={<RotateCcw className="size-4" />}>
              Neu starten
            </SecondaryButton>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto px-4 pb-44 pt-4 sm:px-6 sm:pt-2">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <div className="rounded-[28px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/70">
                {activeStep ? (
                  <>
                    <span className="font-medium text-white">{activeStep.title}</span>
                    {' · '}
                    {activeStep.type}
                    {activeStep.exerciseType ? ` · ${activeStep.exerciseType}` : ''}
                  </>
                ) : (
                  'Fahrplan wird erstellt…'
                )}
              </div>
              {state.messages.map((message) => (
                <LearnPathChatMessage key={message.id} message={message} />
              ))}
              {state.loading ? <LearnPathThinkingCard /> : null}
              {state.error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {state.error}
                </div>
              ) : null}
              <div className="h-8" />
            </div>
          </div>
        </div>

        <LearnPathOverviewPanel
          open={state.panelOpen}
          view={state.panelView}
          mode={mode}
          subjectName={props.subjectName}
          topicName={props.topicName}
          currentChapterName={currentChapterName}
          currentRequirementName={currentRequirementName}
          activePlan={activePlan}
          activeStep={activeStep}
          overviewItems={props.overviewItems}
          onClose={() => props.onPanelOpenChange(false)}
          onBackToOverview={() => props.onPanelViewChange('all_requirements')}
          onShowCurrentRequirement={() => props.onPanelViewChange('current_requirement')}
          onStartRequirement={(item, nextMode) => {
            props.onStartRequirement(item, nextMode);
            props.onPanelOpenChange(false);
            props.onPanelViewChange('current_requirement');
          }}
        />

        <div className="relative border-t border-white/8 bg-slate-950/75 px-4 py-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => {
              props.onPanelViewChange('current_requirement');
              props.onPanelOpenChange(!state.panelOpen);
            }}
            className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white sm:left-6"
          >
            <LayoutGrid className="size-4" />
            Übersicht
          </button>

          <div className="mx-auto w-full max-w-4xl pl-0 sm:pl-24">
            {state.pathCompleted ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-white/75">
                  Alle Requirements im Wissenspfad wurden abgeschlossen.
                </div>
                <PrimaryButton onClick={props.onRestart}>Erneut starten</PrimaryButton>
              </div>
            ) : state.waitingForUser && state.pendingExercise ? (
              <LearnPathExerciseRenderer
                key={`${state.activeStepId ?? 'exercise'}-${state.pendingExercise.type}`}
                exercise={state.pendingExercise}
                disabled={state.loading}
                onSubmit={props.onExerciseSubmit}
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
                    disabled={!canUseTextInput || state.loading || !draft.trim()}
                  >
                    Antworten
                  </PrimaryButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
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
        isUser
          ? 'bg-white/10 text-white shadow-[0_8px_30px_rgba(15,23,42,0.16)]'
          : 'border border-white/8 bg-[#243957]/45 text-white shadow-[0_8px_30px_rgba(15,23,42,0.18)]'
      }`}
    >
      {isUser ? (
        <div className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</div>
      ) : (
        <ChatMarkdownContent content={message.content} />
      )}
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
