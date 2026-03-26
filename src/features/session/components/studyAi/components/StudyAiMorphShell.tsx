import { motion } from 'framer-motion';
import { Bot, Maximize2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import { GhostButton, SecondaryButton } from '../../../../../components/Button';
import { ChatInputRow } from '../../../../../components/chat/ChatInputRow';
import type { StudyAiMessage, StudyAiUiMode } from '../../../stores/studyAiChatStore';
import { StudyAiGeneratingDots } from './StudyAiGeneratingDots';
import { StudyAiMessageList } from './StudyAiMessageList';

const SPRING = { type: 'spring', stiffness: 520, damping: 44 } as const;

export function StudyAiMorphShell(props: {
  mode: StudyAiUiMode;
  isCompactDevice: boolean;
  autoFocusCenter: boolean;
  messages: StudyAiMessage[];
  sending: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onOpenCenter: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onClear: () => void;
  onRegenerate?: () => void;
  onRetryFailedRequest?: () => void;
  editingMessageId?: string | null;
  onStartEditMessage?: (messageId: string) => void;
  onCancelEditMessage?: () => void;
  onSubmitEditMessage?: (messageId: string, content: string) => void;
}) {
  const { stageClass, shellClass } = useStudyAiMorphLayout(props.mode);
  const floatingScrollRef = useRef<HTMLDivElement | null>(null);
  const prevModeRef = useRef<StudyAiUiMode | null>(null);

  useEffect(() => {
    const el = floatingScrollRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    const raf = requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    return () => cancelAnimationFrame(raf);
  }, [props.messages.length, props.sending]);

  useEffect(() => {
    // Beim Wechsel in den Floating-Mode einmalig ans Ende springen.
    if (props.mode !== 'floating') {
      prevModeRef.current = props.mode;
      return;
    }

    if (prevModeRef.current === 'floating') return;
    prevModeRef.current = props.mode;

    const el = floatingScrollRef.current;
    if (!el) return;

    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };

    // Warte auf Layout/Render, damit scrollHeight sicher korrekt ist.
    const raf = requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    return () => cancelAnimationFrame(raf);
  }, [props.mode]);

  return (
    <div
      className={stageClass}
      onPointerDown={(e) => {
        if (props.mode !== 'center') return;
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <motion.div
        layout
        transition={SPRING}
        className={['pointer-events-auto', shellClass].join(' ')}
      >
        {props.mode === 'button' ? (
          <button
            type="button"
            className="grid size-full place-items-center rounded-full"
            onClick={props.onOpenCenter}
            aria-label="KI öffnen"
          >
            <Bot className="size-6" />
          </button>
        ) : null}

        {props.mode === 'center' ? (
          <div>
            <ChatInputRow
              value={props.draft}
              onChange={props.onDraftChange}
              onSubmit={props.onSubmit}
              sending={props.sending}
              placeholder="Frage zur Aufgabe…"
              autoFocus={props.isCompactDevice ? props.autoFocusCenter : true}
              onStop={props.onStop}
            />
          </div>
        ) : null}

        {props.mode === 'overlay' ? (
          <div>
            <ChatInputRow
              value={props.draft}
              onChange={props.onDraftChange}
              onSubmit={props.onSubmit}
              sending={props.sending}
              placeholder="Nachricht senden…"
              autoFocus={props.isCompactDevice ? false : true}
              onStop={props.onStop}
            />
          </div>
        ) : null}

        {props.mode === 'floating' ? (
          <>
            <div className="flex  w-full justify-between gap-2 absolute right-0 px-3 top-4">
              <GhostButton onClick={props.onMaximize}>
                <Maximize2 className="size-4" />
              </GhostButton>
              <SecondaryButton
                className="bg-white/10!"
                onClick={props.onClose}
                icon={<IoClose />}
              />
            </div>

            <div
              ref={floatingScrollRef}
              className="max-h-[440px] overflow-y-auto w-full pt-16 px-3 pb-28 select-text"
            >
              <StudyAiMessageList
                messages={props.messages}
                compact
                sending={props.sending}
                onRegenerate={props.onRegenerate}
                editingMessageId={props.editingMessageId}
                onStartEditMessage={props.onStartEditMessage}
                onCancelEditMessage={props.onCancelEditMessage}
                onSubmitEditMessage={props.onSubmitEditMessage}
              />
              {props.sending ? (
                <div className="mt-2">
                  <StudyAiGeneratingDots />
                </div>
              ) : null}
              {props.error ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-rose-200">
                  <span>{props.error}</span>
                  {props.onRetryFailedRequest ? (
                    <button
                      type="button"
                      onClick={props.onRetryFailedRequest}
                      disabled={props.sending}
                      className="rounded-md px-2 py-1 text-white/90 hover:bg-white/10 disabled:opacity-50"
                    >
                      Erneut versuchen
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="p-2 pt-4 bg-linear-to-b from-transparent to-[#243957] absolute bottom-0 left-0 right-0">
              <ChatInputRow
                value={props.draft}
                onChange={props.onDraftChange}
                onSubmit={props.onSubmit}
                sending={props.sending}
                placeholder="Nachricht…"
                dense
                autoFocus={props.isCompactDevice ? false : true}
                onStop={props.onStop}
              />
            </div>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}

function useStudyAiMorphLayout(mode: StudyAiUiMode) {
  return useMemo(() => {
    const LAYOUT_BY_MODE: Record<
      StudyAiUiMode,
      {
        stageClass: string;
        shellClass: string;
      }
    > = {
      button: {
        stageClass: 'absolute inset-0 flex items-end justify-start p-6 pointer-events-none',
        shellClass:
          'grid size-18 place-items-center rounded-full border border-white/5 bg-[#243957]/80 text-white shadow-lg backdrop-blur',
      },
      center: {
        stageClass: 'absolute inset-0 grid place-items-center items-end p-6 pointer-events-auto',
        shellClass:
          'w-124 rounded-4xl border border-white/5 bg-[#243957]/80 px-3 py-2 text-white shadow-lg backdrop-blur',
      },
      overlay: {
        stageClass: 'absolute inset-0 flex items-end justify-center pb-6 pointer-events-none',
        shellClass:
          'w-124 rounded-4xl border border-white/5 bg-white/10 p-2 text-white shadow-lg backdrop-blur',
      },
      floating: {
        stageClass: 'absolute inset-0 flex items-end justify-start p-6 pointer-events-none',
        shellClass:
          'w-[360px] relative overflow-hidden rounded-3xl border border-white/10 bg-[#243957]/70 text-white shadow-2xl backdrop-blur',
      },
    };

    return LAYOUT_BY_MODE[mode];
  }, [mode]);
}
