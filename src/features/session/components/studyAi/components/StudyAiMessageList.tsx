import { Copy, Pencil, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatMarkdownContent } from '../../../../../components/chat/ChatMarkdownContent';
import { ChatMessage } from '../../../../../components/chat/ChatMessage';
import { GhostButton, PrimaryButton } from '../../../../../components/Button';
import { chatMarkdownClassName } from '../../../../../components/chat/chatMarkdownUtils';
import type { StudyAiMessage } from '../../../stores/studyAiChatStore';

const REVEAL_DURATION_MS = 900;
const CHUNK_SIZE = 3;

const revealedMessageIds = new Set<string>();

function splitRevealWords(content: string) {
  return content.split(/\s+/).filter(Boolean);
}

function isTouchLikeDevice() {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches)
  );
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function StudyAiAssistantMessage(props: {
  content: string;
  compact?: boolean;
  isLastAssistant: boolean;
  sending?: boolean;
  animateReveal: boolean;
  onRevealComplete?: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
}) {
  const {
    animateReveal,
    compact,
    content,
    isLastAssistant,
    onCopy,
    onRegenerate,
    onRevealComplete,
    sending,
  } = props;
  const hasCalledCompleteRef = useRef(false);
  const words = useMemo(() => splitRevealWords(content), [content]);
  const [revealedWordCount, setRevealedWordCount] = useState(() =>
    animateReveal ? 0 : splitRevealWords(content).length,
  );
  const displayedContent =
    !animateReveal || revealedWordCount >= words.length
      ? content
      : words.slice(0, revealedWordCount).join(' ');

  useEffect(() => {
    if (!animateReveal || revealedWordCount >= words.length) {
      return;
    }
    hasCalledCompleteRef.current = false;
    const interval = Math.max(
      40,
      REVEAL_DURATION_MS / Math.max(1, Math.ceil(words.length / CHUNK_SIZE)),
    );
    const timer = window.setInterval(() => {
      setRevealedWordCount((current) => Math.min(current + CHUNK_SIZE, words.length));
    }, interval);
    return () => window.clearInterval(timer);
  }, [animateReveal, revealedWordCount, words.length]);

  useEffect(() => {
    if (!animateReveal || hasCalledCompleteRef.current || words.length === 0) {
      return;
    }
    if (revealedWordCount < words.length) {
      return;
    }
    hasCalledCompleteRef.current = true;
    onRevealComplete?.();
  }, [animateReveal, onRevealComplete, revealedWordCount, words.length]);

  return (
    <div className="w-full">
      <div className={[chatMarkdownClassName, compact ? 'text-sm' : 'text-base'].join(' ')}>
        {displayedContent.length > 0 ? (
          <ChatMarkdownContent content={displayedContent} compact={compact} />
        ) : null}
      </div>
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onCopy) onCopy();
            else copyToClipboard(content);
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/90 hover:bg-white/10 hover:text-slate-100"
          aria-label="Antwort kopieren"
        >
          <Copy className="size-3.5" />
          Kopieren
        </button>
        {isLastAssistant && onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={sending}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/90 hover:bg-white/10 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Antwort neu generieren"
          >
            <RefreshCw className="size-3.5" />
            Neu generieren
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function StudyAiMessageList(props: {
  messages: StudyAiMessage[];
  compact?: boolean;
  sending?: boolean;
  onRegenerate?: () => void;
  editingMessageId?: string | null;
  onStartEditMessage?: (messageId: string) => void;
  onCancelEditMessage?: () => void;
  onSubmitEditMessage?: (messageId: string, content: string) => void;
}) {
  const {
    compact,
    editingMessageId,
    messages,
    onCancelEditMessage,
    onRegenerate,
    onStartEditMessage,
    onSubmitEditMessage,
    sending,
  } = props;
  const lastAssistantId = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant')?.id,
    [messages],
  );
  const [editingState, setEditingState] = useState<{ draft: string; messageId: string | null }>({
    draft: '',
    messageId: null,
  });
  const [lastTap, setLastTap] = useState<{ messageId: string; atMs: number } | null>(null);
  const activeEditingMessage = useMemo(
    () => messages.find((message) => message.id === editingMessageId) ?? null,
    [editingMessageId, messages],
  );
  const editingDraft =
    editingMessageId && editingState.messageId === editingMessageId
      ? editingState.draft
      : activeEditingMessage?.content ?? '';

  const startEditing = (message: StudyAiMessage) => {
    if (message.role !== 'user' || !onStartEditMessage || sending) {
      return;
    }
    setLastTap(null);
    setEditingState({ draft: message.content, messageId: message.id });
    onStartEditMessage(message.id);
  };

  const cancelEditing = () => {
    setLastTap(null);
    setEditingState({ draft: '', messageId: null });
    onCancelEditMessage?.();
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-full space-y-3">
      {messages.map((message) => {
        const isUserMessage = message.role === 'user';
        const isEditingMessage = editingMessageId === message.id;
        const canStartEditing = isUserMessage && Boolean(onStartEditMessage) && !editingMessageId;
        const bubbleClassName = [
          'rounded-3xl px-4 py-2.5',
          compact ? 'text-[13px]' : '',
          isUserMessage
            ? 'group whitespace-pre-wrap wrap-anywhere bg-white/10 text-white select-text'
            : 'text-white/95 select-text',
          isUserMessage && isEditingMessage ? 'w-[60%] px-5 py-4' : 'max-w-full',
        ].join(' ');

        return (
          <ChatMessage
            key={message.id}
            align={isUserMessage ? 'end' : 'start'}
            bubbleClassName={bubbleClassName}
            onBubbleClick={() => {
              if (
                !isUserMessage ||
                isEditingMessage ||
                !onStartEditMessage ||
                sending ||
                !isTouchLikeDevice()
              ) {
                return;
              }
              const now = Date.now();
              if (lastTap && lastTap.messageId === message.id && now - lastTap.atMs < 320) {
                startEditing(message);
                setLastTap(null);
                return;
              }
              setLastTap({ messageId: message.id, atMs: now });
            }}
            action={
              canStartEditing ? (
                <button
                  type="button"
                  onClick={() => startEditing(message)}
                  aria-label="Nachricht bearbeiten"
                  className="mt-2 rounded-md p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="size-3.5" />
                </button>
              ) : null
            }
          >
            {message.role === 'assistant' ? (
              <StudyAiAssistantMessage
                content={message.content}
                compact={compact}
                isLastAssistant={message.id === lastAssistantId}
                sending={sending}
                animateReveal={message.id === lastAssistantId && !revealedMessageIds.has(message.id)}
                onRevealComplete={() => revealedMessageIds.add(message.id)}
                onCopy={() => copyToClipboard(message.content)}
                onRegenerate={message.id === lastAssistantId ? onRegenerate : undefined}
              />
            ) : (
              <div className="select-text">
                {isEditingMessage ? (
                  <div className="w-full">
                    <textarea
                      value={editingDraft}
                      onChange={(event) =>
                        setEditingState({ draft: event.target.value, messageId: message.id })
                      }
                      className="w-full resize-none text-white outline-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <GhostButton onClick={cancelEditing}>Abbrechen</GhostButton>
                      <PrimaryButton
                        disabled={!editingDraft.trim() || sending}
                        onClick={() => onSubmitEditMessage?.(message.id, editingDraft)}
                      >
                        Senden
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">{message.content}</div>
                  </div>
                )}
              </div>
            )}
          </ChatMessage>
        );
      })}
    </div>
  );
}
