import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion';
import { Bot, Maximize2, Minimize2, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderAttemptCompositePngDataUrl } from '../../../../ink/attemptComposite';
import { sendStudyAiMessage } from '../../ai/aiClient';
import {
  useStudyAiChatStore,
  type StudyAiMessage,
  type StudyAiUiMode,
} from '../../stores/studyAiChatStore';

const SPRING = { type: 'spring', stiffness: 520, damping: 44 } as const;

const FALLBACK_CONV = { messages: [] as StudyAiMessage[], docId: null as string | null };
const FALLBACK_UI = { mode: 'button' as StudyAiUiMode, panelX: 0, panelY: 0 };

export function StudyAiWidget(props: {
  assetId: string;
  pdfData: Uint8Array | null;
  boundSessionKey: string | null;
  currentAttemptId: string | null;
}) {
  const conversationKey = useMemo(() => {
    if (!props.boundSessionKey) return null;
    return `${props.boundSessionKey}:${props.assetId}`;
  }, [props.boundSessionKey, props.assetId]);

  const ensureConversation = useStudyAiChatStore((s) => s.ensureConversation);
  const conv = useStudyAiChatStore((s) =>
    conversationKey ? s.conversations[conversationKey] ?? FALLBACK_CONV : FALLBACK_CONV,
  );
  const ui = useStudyAiChatStore((s) =>
    conversationKey ? s.uiByConversation[conversationKey] ?? FALLBACK_UI : FALLBACK_UI,
  );
  const setUiMode = useStudyAiChatStore((s) => s.setUiMode);
  const setUiPanelPos = useStudyAiChatStore((s) => s.setUiPanelPos);
  const append = useStudyAiChatStore((s) => s.append);
  const clearConversation = useStudyAiChatStore((s) => s.clearConversation);
  const setDocId = useStudyAiChatStore((s) => s.setDocId);

  useEffect(() => {
    if (!conversationKey) return;
    ensureConversation(conversationKey);
  }, [conversationKey, ensureConversation]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const send = async (text: string) => {
    if (!conversationKey) {
      setSendError('Keine Session aktiv.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!props.pdfData) {
      setSendError('PDF ist noch nicht geladen.');
      return;
    }

    setSending(true);
    setSendError(null);
    append(conversationKey, { role: 'user', content: trimmed });
    setDraft('');
    setUiMode(conversationKey, 'overlay');

    try {
      const attemptImageDataUrl =
        props.currentAttemptId && props.pdfData
          ? await renderAttemptCompositePngDataUrl({
              attemptId: props.currentAttemptId,
              pdfData: props.pdfData,
              maxPdfBytes: 12 * 1024 * 1024,
              maxOutputPixels: 12_000_000,
            })
          : null;

      const res = await sendStudyAiMessage({
        conversationKey,
        messages: conv.messages.concat([
          { id: 'local', role: 'user', content: trimmed, createdAtMs: Date.now() },
        ]),
        docId: conv.docId,
        pdfData: conv.docId ? null : props.pdfData,
        attemptImageDataUrl,
      });

      if (res.docId && res.docId !== conv.docId) setDocId(conversationKey, res.docId);
      append(conversationKey, { role: 'assistant', content: res.assistantMessage });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!conversationKey) return;
      if (e.key === 'Escape') {
        const mode = ui.mode;
        if (mode === 'overlay') setUiMode(conversationKey, 'floating');
        else if (mode === 'center') setUiMode(conversationKey, 'button');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [conversationKey, setUiMode, ui.mode]);

  if (!conversationKey) return null;

  return (
    <div className="fixed inset-0 z-45 pointer-events-none">
      <AnimatePresence initial={false}>
        {ui.mode === 'button' ? (
          <motion.button
            key="ai-button"
            layoutId="study-ai-shell"
            type="button"
            className="pointer-events-auto absolute bottom-5 left-5 grid size-14 place-items-center rounded-full border border-white/10 bg-[#243957]/80 text-white shadow-lg backdrop-blur"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING}
            onClick={() => setUiMode(conversationKey, 'center')}
            aria-label="KI öffnen"
          >
            <Bot className="size-6" />
          </motion.button>
        ) : null}

        {ui.mode === 'center' ? (
          <motion.div
            key="ai-center"
            className="pointer-events-none absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <motion.div
              layoutId="study-ai-shell"
              className="pointer-events-auto w-[min(720px,calc(100vw-40px))] rounded-full border border-white/10 bg-[#243957]/80 px-3 py-2 shadow-2xl backdrop-blur"
              transition={SPRING}
            >
              <InputRow
                value={draft}
                onChange={setDraft}
                onSubmit={() => void send(draft)}
                sending={sending}
                placeholder="Frage zur Aufgabe…"
              />
              {sendError ? (
                <div className="px-2 pb-1 pt-2 text-xs text-rose-200">{sendError}</div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}

        {ui.mode === 'overlay' ? (
          <ChatOverlay
            key="ai-overlay"
            messages={conv.messages}
            sending={sending}
            error={sendError}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={() => void send(draft)}
            onMinimize={() => setUiMode(conversationKey, 'floating')}
            onClose={() => setUiMode(conversationKey, 'button')}
            onClear={() => clearConversation(conversationKey)}
          />
        ) : null}

        {ui.mode === 'floating' ? (
          <FloatingChatPanel
            key="ai-floating"
            messages={conv.messages}
            sending={sending}
            error={sendError}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={() => void send(draft)}
            onMaximize={() => setUiMode(conversationKey, 'overlay')}
            onClose={() => setUiMode(conversationKey, 'button')}
            onClear={() => clearConversation(conversationKey)}
            storedPos={{ x: ui.panelX, y: ui.panelY }}
            onPosChange={(p) => setUiPanelPos(conversationKey, p)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ChatOverlay(props: {
  messages: StudyAiMessage[];
  sending: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.messages.length, props.sending]);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="absolute inset-x-0 top-0 flex justify-center px-4" style={{ paddingTop: 88 }}>
        <div className="w-[min(960px,100%)] rounded-3xl border border-white/10 bg-[#0b1220]/80 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">KI Chat</div>
              <div className="text-xs text-slate-300">Kontext: PDF + Verlauf</div>
            </div>

            <div className="flex items-center gap-2">
              <IconButton ariaLabel="Chat leeren" onClick={props.onClear} disabled={props.sending}>
                <Trash2 className="size-4" />
              </IconButton>
              <IconButton ariaLabel="Verkleinern" onClick={props.onMinimize}>
                <Minimize2 className="size-4" />
              </IconButton>
              <IconButton ariaLabel="Schließen" onClick={props.onClose}>
                <X className="size-4" />
              </IconButton>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="max-h-[min(62vh,680px)] overflow-auto px-4 py-4"
            style={{ paddingBottom: 84 }}
          >
            <MessageList messages={props.messages} />
            {props.sending ? (
              <div className="mt-3 text-xs text-slate-300">Antwort wird generiert…</div>
            ) : null}
            {props.error ? <div className="mt-3 text-xs text-rose-200">{props.error}</div> : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
            <div className="rounded-2xl border border-white/10 bg-[#243957]/60 p-2 backdrop-blur">
              <InputRow
                value={props.draft}
                onChange={props.onDraftChange}
                onSubmit={props.onSubmit}
                sending={props.sending}
                placeholder="Nachricht senden…"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FloatingChatPanel(props: {
  messages: StudyAiMessage[];
  sending: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onClear: () => void;
  storedPos: { x: number; y: number };
  onPosChange: (p: { x: number; y: number }) => void;
}) {
  const dragControls = useDragControls();
  const x = useMotionValue(props.storedPos.x);
  const y = useMotionValue(props.storedPos.y);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    x.set(props.storedPos.x);
    y.set(props.storedPos.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.storedPos.x, props.storedPos.y]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.messages.length, props.sending]);

  const gripProps = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        dragControls.start(e);
      },
    }),
    [dragControls],
  );

  return (
    <motion.div
      className="pointer-events-auto absolute bottom-5 left-5 touch-none"
      drag
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 8, left: 8, right: 8, bottom: 8 }}
      dragElastic={0}
      dragMomentum={false}
      style={{ x, y, width: 360 }}
      transition={SPRING}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onDragEnd={() => props.onPosChange({ x: x.get(), y: y.get() })}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#243957]/70 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <button
            type="button"
            {...gripProps}
            className="cursor-grab rounded-full px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/5 active:cursor-grabbing"
          >
            KI
          </button>
          <div className="flex items-center gap-1">
            <IconButton ariaLabel="Leeren" onClick={props.onClear} disabled={props.sending}>
              <Trash2 className="size-4" />
            </IconButton>
            <IconButton ariaLabel="Maximieren" onClick={props.onMaximize}>
              <Maximize2 className="size-4" />
            </IconButton>
            <IconButton ariaLabel="Schließen" onClick={props.onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
        </div>

        <div ref={scrollerRef} className="max-h-[340px] overflow-auto px-3 py-3">
          <MessageList messages={props.messages} compact />
          {props.sending ? (
            <div className="mt-2 text-xs text-slate-200/80">Antwort wird generiert…</div>
          ) : null}
          {props.error ? <div className="mt-2 text-xs text-rose-200">{props.error}</div> : null}
        </div>

        <div className="border-t border-white/10 p-2">
          <InputRow
            value={props.draft}
            onChange={props.onDraftChange}
            onSubmit={props.onSubmit}
            sending={props.sending}
            placeholder="Nachricht…"
            dense
          />
        </div>
      </div>
    </motion.div>
  );
}

function MessageList(props: { messages: StudyAiMessage[]; compact?: boolean }) {
  if (props.messages.length === 0) {
    return (
      <div className="text-sm text-slate-200/80">
        Stell eine Frage zur Aufgabe. Ich nutze die PDF und deinen bisherigen Verlauf als Kontext.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={[
              'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
              props.compact ? 'text-[13px]' : '',
              m.role === 'user'
                ? 'bg-indigo-500/90 text-white'
                : 'bg-white/5 text-slate-100 border border-white/10',
            ].join(' ')}
          >
            {m.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function InputRow(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  sending: boolean;
  placeholder: string;
  dense?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={inputRef}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.dense ? 1 : 2}
        className={[
          'min-h-[42px] flex-1 resize-none rounded-2xl bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40',
          props.dense ? 'min-h-[36px]' : '',
        ].join(' ')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            props.onSubmit();
          }
        }}
      />
      <button
        type="button"
        disabled={props.sending || !props.value.trim()}
        onClick={props.onSubmit}
        className="grid size-10 place-items-center rounded-full bg-indigo-500 text-white disabled:opacity-50"
        aria-label="Senden"
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}

function IconButton(props: {
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.ariaLabel}
      onClick={props.onClick}
      disabled={props.disabled}
      className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/5 disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
