import { ChevronLeft } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import { ChatInputRow } from '../../../../../components/chat/ChatInputRow';
import { ChatMarkdownContent } from '../../../../../components/chat/ChatMarkdownContent';
import { ChatMessage } from '../../../../../components/chat/ChatMessage';
import type { LearnPathMode } from '../../../../../domain/models';
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
  onContinue: () => void;
  onSend: () => void;
  onExerciseSubmit: (
    response: LearnPathTurnResponse,
    exercise: LearnPathState['pendingExercise'],
  ) => void;
  onStartRequirement: (item: LearnPathRequirementOverviewItem, mode: LearnPathMode) => void;
  onPanelOpenChange: (open: boolean) => void;
  onPanelViewChange: (view: LearnPathPanelView) => void;
}) {
  const {
    state,
    mode,
    draft,

    currentChapterName,
    currentRequirementName,
    activePlan,
    activeStep,
  } = props;
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
    <section className="relative min-h-dvh">
      <div className="relative h-dvh">
        <div className="fixed  top-0 z-30 left-0 flex justify-center px-4 pt-5">
          <div className="flex w-full max-w-5xl items-start gap-3">
            <SecondaryButton onClick={props.onBack} icon={<ChevronLeft />}></SecondaryButton>
            <div className="pointer-events-auto min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {currentRequirementName ?? 'Requirement'}
              </div>
              <div className="mt-1 truncate text-xs text-white/60">
                {[props.topicName, currentChapterName].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 overflow-y-auto px-4 pb-52 pt-28 sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {activeStep ? (
              <div className="rounded-[24px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/70 backdrop-blur">
                <span className="font-medium text-white">{activeStep.title}</span>
                {' · '}
                {activeStep.type}
                {activeStep.exerciseType ? ` · ${activeStep.exerciseType}` : ''}
              </div>
            ) : null}
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

        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-6 sm:px-6">
          <div className="relative w-full">
            {/* <button
              type="button"
              onClick={() => {
                props.onPanelViewChange('current_requirement');
                props.onPanelOpenChange(!state.panelOpen);
              }}
              className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white sm:left-6"
            >
              <LayoutGrid className="size-4" />
              Übersicht
            </button> */}

            <div className="mx-auto w-full max-w-2xl pl-0 sm:pl-24">
              {state.pathCompleted ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-white/75">
                    Alle Requirements im Wissenspfad wurden abgeschlossen.
                  </div>
                  <PrimaryButton onClick={props.onBack}>Zur Übersicht</PrimaryButton>
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
                <div className="space-y-3 bg-white/10 rounded-4xl py-2 px-2 backdrop-blur-2xl">
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
                  {/* <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-white/45">
                      {state.waitingForUser
                        ? isMissingExerciseFallback
                          ? 'Fallback aktiv: Antwort per Text ist freigeschaltet.'
                          : 'Die KI wartet auf deine Antwort.'
                        : 'Die KI steuert den Fahrplan aktuell selbst.'}
                    </div>
                  </div> */}
                </div>
              )}
            </div>
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
      bubbleClassName={`rounded-3xl px-4 py-3 ${
        isUser
          ? 'bg-white/10 text-white max-w-[60%] shadow-[0_8px_30px_rgba(15,23,42,0.16)]'
          : 'bg-transparent text-white shadow-none'
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
            <span className="rounded-full border border-white/10 px-2 py-1">
              {message.stepType}
            </span>
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
