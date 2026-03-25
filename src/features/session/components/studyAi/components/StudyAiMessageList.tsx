import 'katex/dist/katex.min.css';
import { Copy, Pencil, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { GhostButton, PrimaryButton } from '../../../../../components/Button';
import type { StudyAiMessage } from '../../../stores/studyAiChatStore';

function normalizeMathDelimiters(input: string) {
  return input
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

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

const markdownClass = [
  'max-w-full',
  'text-slate-100 leading-relaxed wrap-anywhere',
  '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:list-outside [&_ol]:list-outside [&_li]:list-item',
  '[&_li::marker]:text-slate-200/80',
  '[&_h1]:text-[1.05em] [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1',
  '[&_h2]:text-[1.02em] [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1',
  '[&_h3]:text-[1em] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
  '[&_blockquote]:my-2 [&_blockquote]:border-l [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_blockquote]:text-slate-200/90',
  '[&_hr]:my-3 [&_hr]:border-white/10',
  '[&_a]:text-sky-300 [&_a]:underline [&_a:hover]:text-sky-200',
  '[&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border [&_table]:border-white/10 [&_table]:rounded-lg',
  '[&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:border-b [&_th]:border-white/10 [&_th]:bg-white/5',
  '[&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-white/10',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3',
  '[&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.95em]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:px-0 [&_pre_code]:py-0',
  '[&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden',
].join(' ');

function MarkdownContent({
  content,
  compact,
  className,
}: {
  content: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={[markdownClass, compact ? 'text-sm' : 'text-base', className ?? ''].join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (p) => <a {...p} target="_blank" rel="noreferrer noopener" />,
          code: ({ className: c, children, ...p }) => (
            <code className={c} {...p}>
              {children}
            </code>
          ),
        }}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
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
  const displayedContent = animateReveal ? words.slice(0, revealedWordCount).join(' ') : content;

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
      <div className={[markdownClass, compact ? 'text-sm' : 'text-base'].join(' ')}>
        {displayedContent.length > 0 ? (
          <MarkdownContent content={displayedContent} compact={compact} />
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
          <div
            key={message.id}
            className={`group flex flex-col ${isUserMessage ? 'items-end' : 'items-start'}`}
          >
            <div
              className={bubbleClassName}
              onClick={() => {
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
            </div>
            {canStartEditing ? (
              <button
                type="button"
                onClick={() => startEditing(message)}
                aria-label="Nachricht bearbeiten"
                className="mt-2 rounded-md p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white"
              >
                <Pencil className="size-3.5" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
