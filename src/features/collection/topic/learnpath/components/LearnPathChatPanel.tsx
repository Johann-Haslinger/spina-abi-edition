import { ChatInputRow } from '../../../../../components/chat/ChatInputRow';
import { ChatMessage } from '../../../../../components/chat/ChatMessage';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import { getRailStepNumber, RAIL_STATE_LABELS } from '../rail/standardRequirementRail';
import { formatRailStateList } from '../learnPathUtils';
import type { LearnPathMessage, LearnPathState } from '../types';
import { LearnPathThinkingCard } from './LearnPathThinkingCard';

export function LearnPathChatPanel(props: {
  state: LearnPathState;
  draft: string;
  totalChapters: number;
  totalRequirements: number;
  currentRequirementPosition: number;
  currentChapterName?: string;
  currentRequirementName?: string;
  onDraftChange: (value: string) => void;
  onRestart: () => void;
  onContinue: () => void;
  onSend: () => void;
}) {
  const {
    state,
    draft,
    totalChapters,
    totalRequirements,
    currentRequirementPosition,
    currentChapterName,
    currentRequirementName,
  } = props;

  return (
    <div className="rounded-3xl border border-white/8 bg-slate-950/25">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <div className="text-xl font-semibold text-white">Wissenspfad</div>
          <div className="mt-2 text-sm text-white/65">
            Kapitel {state.currentChapterIndex + 1} von {totalChapters}
            {' · '}
            Requirement {currentRequirementPosition} von {totalRequirements}
            {' · '}
            State {getRailStepNumber(state.currentState)} von 7
          </div>
        </div>
        <SecondaryButton onClick={props.onRestart} disabled={state.loading}>
          Neu starten
        </SecondaryButton>
      </div>

      <div className="border-b border-white/8 px-5 py-4">
        <div className="text-xs uppercase tracking-wide text-white/45">Aktiver Schritt</div>
        <div className="mt-1 text-lg font-semibold text-white">
          {currentChapterName ?? 'Kapitel'}
          {' · '}
          {currentRequirementName ?? 'Requirement'}
        </div>
        <div className="mt-2 text-sm text-white/70">
          Current State: <span className="text-white">{state.currentState}</span>
          {' · '}
          {RAIL_STATE_LABELS[state.currentState]}
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
        ) : state.canContinue ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Die KI bleibt im aktuellen Schritt. Mit einem Klick geht es im selben State weiter.
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
                  ? 'Antworte auf die Frage der KI…'
                  : 'Antworten werden freigeschaltet, sobald der Rail eine Nutzerantwort erwartet.'
              }
              disabled={!state.waitingForUser || state.loading}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/45">
                {state.waitingForUser
                  ? 'Die KI wartet auf deine Antwort.'
                  : 'Die KI steuert den Rail aktuell selbst.'}
              </div>
              <PrimaryButton
                onClick={props.onSend}
                disabled={!state.waitingForUser || state.loading || !draft.trim()}
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
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
      {!isUser && message.currentState ? (
        <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/65">
          <div>Current State: {message.currentState}</div>
          <div>Allowed Next States: {formatRailStateList(message.allowedNextStates ?? [])}</div>
          <div>Suggested Next State: {message.suggestedNextState ?? '–'}</div>
          <div>Applied Next State: {message.appliedNextState ?? '–'}</div>
          <div>State Changed: {message.stateChanged ? 'yes' : 'no'}</div>
          <div>Await User Reply: {message.awaitUserReply ? 'yes' : 'no'}</div>
        </div>
      ) : null}
    </ChatMessage>
  );
}
