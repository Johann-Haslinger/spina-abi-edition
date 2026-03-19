import { motion } from 'framer-motion';
import 'katex/dist/katex.min.css';
import { Copy, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
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
          code: ({ className: c, children, ...p }) => {
            const isBlock = Boolean(c?.includes('language-'));
            if (isBlock)
              return (
                <code className={c} {...p}>
                  {children}
                </code>
              );
            return (
              <code className={c} {...p}>
                {children}
              </code>
            );
          },
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
  const { content, animateReveal } = props;
  const [visibleLength, setVisibleLength] = useState(animateReveal ? 0 : undefined);
  const [prevVisibleLength, setPrevVisibleLength] = useState(0);
  const hasCalledCompleteRef = useRef(false);

  const isRevealing = animateReveal && typeof visibleLength === 'number';
  const effectiveLength = isRevealing ? visibleLength : content.length;
  const prevLen = isRevealing ? prevVisibleLength : effectiveLength;
  const stableContent = content.slice(0, prevLen);
  const newContent = content.slice(prevLen, effectiveLength);

  useEffect(() => {
    if (!animateReveal || !content) return;
    setVisibleLength(0);
    setPrevVisibleLength(0);
    hasCalledCompleteRef.current = false;
    const words = content.split(/\s+/);
    let wordIndex = 0;
    const interval = Math.max(
      40,
      REVEAL_DURATION_MS / Math.max(1, Math.ceil(words.length / CHUNK_SIZE)),
    );
    const timer = setInterval(() => {
      setVisibleLength((prev) => {
        const nextPartial = words
          .slice(0, Math.min(wordIndex + CHUNK_SIZE, words.length))
          .join(' ');
        const nextLen = nextPartial.length;
        setPrevVisibleLength(prev ?? 0);
        wordIndex = Math.min(wordIndex + CHUNK_SIZE, words.length);
        if (wordIndex >= words.length && !hasCalledCompleteRef.current) {
          hasCalledCompleteRef.current = true;
          queueMicrotask(() => props.onRevealComplete?.());
        }
        return nextLen;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [animateReveal, content]);

  useEffect(() => {
    if (!animateReveal && content) {
      setVisibleLength(undefined);
      props.onRevealComplete?.();
    }
  }, [animateReveal, content]);

  return (
    <div className="w-full">
      <div className={[markdownClass, props.compact ? 'text-sm' : 'text-base'].join(' ')}>
        {stableContent.length > 0 ? (
          <MarkdownContent content={stableContent} compact={props.compact} />
        ) : null}
        {newContent.length > 0 ? (
          <motion.span
            key={effectiveLength}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="inline"
          >
            <MarkdownContent content={newContent} compact={props.compact} />
          </motion.span>
        ) : null}
      </div>
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (props.onCopy) props.onCopy();
            else void navigator.clipboard.writeText(props.content);
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/90 hover:bg-white/10 hover:text-slate-100"
          aria-label="Antwort kopieren"
        >
          <Copy className="size-3.5" />
          Kopieren
        </button>
        {props.isLastAssistant && props.onRegenerate ? (
          <button
            type="button"
            onClick={props.onRegenerate}
            disabled={props.sending}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/90 hover:bg-white/10 hover:text-slate-100 disabled:opacity-50 disabled:pointer-events-none"
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
}) {
  if (props.messages.length === 0) {
    return (
      <div className="text-sm text-slate-200/80">
        Stell eine Frage zur Aufgabe. Ich nutze die PDF und deinen bisherigen Verlauf als Kontext.
      </div>
    );
  }

  const lastAssistantId = [...props.messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div className="space-y-3 w-full max-w-full">
      {props.messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={[
              'rounded-2xl px-3 py-2',
              props.compact ? 'text-[13px]' : '',
              m.role === 'user'
                ? 'whitespace-pre-wrap wrap-anywhere bg-white/10 text-white max-w-[60%]'
                : ' text-white/95 ',
            ].join(' ')}
          >
            {m.role === 'assistant' ? (
              <StudyAiAssistantMessage
                content={m.content}
                compact={props.compact}
                isLastAssistant={m.id === lastAssistantId}
                sending={props.sending}
                animateReveal={m.id === lastAssistantId && !revealedMessageIds.has(m.id)}
                onRevealComplete={() => revealedMessageIds.add(m.id)}
                onCopy={() => void navigator.clipboard.writeText(m.content)}
                onRegenerate={m.id === lastAssistantId ? props.onRegenerate : undefined}
              />
            ) : (
              m.content
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
