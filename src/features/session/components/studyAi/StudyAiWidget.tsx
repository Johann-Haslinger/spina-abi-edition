import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderAttemptCompositePngDataUrl } from '../../../../ink/attemptComposite';
import { sendStudyAiMessage } from '../../ai/aiClient';
import {
  useStudyAiChatStore,
  type StudyAiMessage,
  type StudyAiUiMode,
} from '../../stores/studyAiChatStore';
import { StudyAiFullscreenOverlay } from './components/StudyAiFullscreenOverlay';
import { StudyAiMorphShell } from './components/StudyAiMorphShell';

const FALLBACK_CONV = { messages: [] as StudyAiMessage[], docId: null as string | null };
const FALLBACK_UI = { mode: 'button' as StudyAiUiMode };

function getIsCompactDevice() {
  if (typeof window === 'undefined') return false;

  const mqSmall = window.matchMedia('(max-width: 1024px)');
  const mqCoarse = window.matchMedia('(pointer: coarse)');
  const mqHoverNone = window.matchMedia('(hover: none)');
  return mqSmall.matches || (mqCoarse.matches && mqHoverNone.matches);
}

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

  const isCompactDevice = useMemo(() => getIsCompactDevice(), []);

  const prevModeRef = useRef<StudyAiUiMode>(ui.mode);
  const shouldAutoFocusCenter =
    isCompactDevice && ui.mode === 'center' && prevModeRef.current === 'button';
  useEffect(() => {
    prevModeRef.current = ui.mode;
  }, [ui.mode]);

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
      const messagesForRequest = conv.messages.concat([
        { id: 'local', role: 'user', content: trimmed, createdAtMs: Date.now() },
      ]);

      let attemptImageDataUrl: string | null = null;
      if (props.currentAttemptId && props.pdfData) {
        try {
          attemptImageDataUrl = await renderAttemptCompositePngDataUrl({
            attemptId: props.currentAttemptId,
            pdfData: props.pdfData,
            maxPdfBytes: 12 * 1024 * 1024,
            maxOutputPixels: 12_000_000,
          });
        } catch {
          // Ohne Attempt-Bild fortsetzen; Edge Function funktioniert auch ohne
        }
      }

      const doSend = (docId: string | null, pdfData: Uint8Array | null) =>
        sendStudyAiMessage({
          conversationKey,
          messages: messagesForRequest,
          docId,
          pdfData,
          attemptImageDataUrl,
        });

      // Always send the PDF (no storage caching).
      const res = await doSend(conv.docId, props.pdfData);

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
        {ui.mode === 'overlay' ? (
          <StudyAiFullscreenOverlay
            key="study-ai-overlay"
            messages={conv.messages}
            sending={sending}
            error={sendError}
            onMinimize={() => setUiMode(conversationKey, 'floating')}
            onClose={() => setUiMode(conversationKey, 'button')}
            onClear={() => clearConversation(conversationKey)}
          />
        ) : null}
      </AnimatePresence>

      <StudyAiMorphShell
        mode={ui.mode}
        isCompactDevice={isCompactDevice}
        autoFocusCenter={shouldAutoFocusCenter}
        messages={conv.messages}
        sending={sending}
        error={sendError}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => void send(draft)}
        onOpenCenter={() =>
          setUiMode(conversationKey, conv.messages.length > 0 ? 'floating' : 'center')
        }
        onMaximize={() => setUiMode(conversationKey, 'overlay')}
        onClose={() => setUiMode(conversationKey, 'button')}
        onClear={() => clearConversation(conversationKey)}
      />
    </div>
  );
}
