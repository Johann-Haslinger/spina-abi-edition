import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderAttemptCompositePngDataUrl } from '../../../../ink/attemptComposite';
import { useInkStore } from '../../../../ink/inkStore';
import { attemptRepo, inkRepo } from '../../../../repositories';
import { useNotificationsStore } from '../../../../stores/notificationsStore';
import { sendStudyAiMessage } from '../../ai/aiClient';
import { appendAttemptAiHelpNote, hasAttemptUsedAiHelp } from '../../review/attemptAiHelp';
import { useFloatingQuickLogPanelStore } from '../../stores/floatingQuickLogPanelStore';
import { useStudyStore } from '../../stores/studyStore';
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
    conversationKey ? (s.conversations[conversationKey] ?? FALLBACK_CONV) : FALLBACK_CONV,
  );
  const ui = useStudyAiChatStore((s) =>
    conversationKey ? (s.uiByConversation[conversationKey] ?? FALLBACK_UI) : FALLBACK_UI,
  );
  const setUiMode = useStudyAiChatStore((s) => s.setUiMode);
  const append = useStudyAiChatStore((s) => s.append);
  const removeLastTurn = useStudyAiChatStore((s) => s.removeLastTurn);
  const updateMessageContent = useStudyAiChatStore((s) => s.updateMessageContent);
  const truncateAfterMessage = useStudyAiChatStore((s) => s.truncateAfterMessage);
  const clearConversation = useStudyAiChatStore((s) => s.clearConversation);
  const setDocId = useStudyAiChatStore((s) => s.setDocId);

  useEffect(() => {
    if (!conversationKey) return;
    ensureConversation(conversationKey);
  }, [conversationKey, ensureConversation]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const failedRequestRef = useRef<{
    messages: StudyAiMessage[];
    docId: string | null;
    attemptImageDataUrl: string | null;
    requireAttemptImage: boolean;
  } | null>(null);
  const pushNotification = useNotificationsStore((s) => s.push);
  const markCurrentAttemptUsedAiHelp = useStudyStore((s) => s.markCurrentAttemptUsedAiHelp);

  const isCompactDevice = useMemo(() => getIsCompactDevice(), []);

  const prevModeRef = useRef<StudyAiUiMode>(ui.mode);
  const shouldAutoFocusCenter =
    isCompactDevice && ui.mode === 'center' && prevModeRef.current === 'button';
  useEffect(() => {
    prevModeRef.current = ui.mode;
  }, [ui.mode]);

  const getConversation = useStudyAiChatStore((s) => s.getConversation);
  const selectedInkAttemptId = useInkStore((s) => s.selectedAttemptId);

  const handleSendError = (message: string) => {
    setSendError(message);
    pushNotification({
      tone: 'error',
      title: 'StudyAI-Nachricht fehlgeschlagen',
      message,
    });
  };

  const isAbortError = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof Error && /aborted|abort/i.test(error.message)) return true;
    return false;
  };

  const executeStudyAiRequest = async (input: {
    messages: StudyAiMessage[];
    docId: string | null;
    attemptImageDataUrl: string | null;
    requireAttemptImage: boolean;
  }) => {
    if (!conversationKey) return;
    if (!props.pdfData) {
      handleSendError('PDF ist noch nicht geladen.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSending(true);
    setSendError(null);
    failedRequestRef.current = null;

    try {
      const res = await sendStudyAiMessage({
        conversationKey,
        messages: input.messages,
        docId: input.docId,
        pdfData: props.pdfData,
        attemptImageDataUrl: input.attemptImageDataUrl,
        requireAttemptImage: input.requireAttemptImage,
        signal: controller.signal,
      });
      if (res.docId && res.docId !== input.docId) setDocId(conversationKey, res.docId);
      append(conversationKey, { role: 'assistant', content: res.assistantMessage });
      failedRequestRef.current = null;
    } catch (e) {
      if (controller.signal.aborted) return;
      if (isAbortError(e)) return;
      failedRequestRef.current = input;
      handleSendError(e instanceof Error ? e.message : 'Fehler beim Senden');
    } finally {
      abortControllerRef.current = null;
      setSending(false);
    }
  };

  const send = async (text: string) => {
    if (!conversationKey) {
      handleSendError('Keine Session aktiv.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!props.pdfData) {
      handleSendError('PDF ist noch nicht geladen.');
      return;
    }

    setEditingMessageId(null);
    setSendError(null);

    try {
      if (props.currentAttemptId) {
        const currentAttempt = await attemptRepo.get(props.currentAttemptId);
        if (!currentAttempt) {
          markCurrentAttemptUsedAiHelp();
        } else if (!hasAttemptUsedAiHelp(currentAttempt.note)) {
          await attemptRepo.update(props.currentAttemptId, {
            note: appendAttemptAiHelpNote(currentAttempt.note),
          });
        }
      }

      append(conversationKey, { role: 'user', content: trimmed });
      setDraft('');
      const panelView = useFloatingQuickLogPanelStore.getState().view;
      if (panelView === 'progressDetails' || panelView === 'review') {
        useFloatingQuickLogPanelStore.getState().setView('progress');
      }
      setUiMode(conversationKey, 'overlay');

      const currentConv = getConversation(conversationKey);
      const messagesForRequest = currentConv.messages;

      const currentAttemptHasInk = props.currentAttemptId
        ? (await inkRepo.listByAttempt(props.currentAttemptId)).length > 0
        : false;
      const shouldRequireAttemptImage = Boolean(props.currentAttemptId && currentAttemptHasInk);
      const attemptIdForAiImage = shouldRequireAttemptImage
        ? props.currentAttemptId
        : selectedInkAttemptId && selectedInkAttemptId !== props.currentAttemptId
        ? selectedInkAttemptId
        : null;
      let attemptImageDataUrl: string | null = null;
      if (attemptIdForAiImage && props.pdfData) {
        try {
          attemptImageDataUrl = await renderAttemptCompositePngDataUrl({
            attemptId: attemptIdForAiImage,
            pdfData: props.pdfData,
            maxPdfBytes: 12 * 1024 * 1024,
            maxOutputPixels: 12_000_000,
          });
        } catch {
          if (shouldRequireAttemptImage) {
            throw new Error(
              'Aktuelles Attempt-Bild konnte nicht erzeugt werden. Bitte kurz erneut versuchen.',
            );
          }
        }
      }

      await executeStudyAiRequest({
        messages: messagesForRequest,
        docId: currentConv.docId,
        attemptImageDataUrl,
        requireAttemptImage: shouldRequireAttemptImage,
      });
    } catch (e) {
      handleSendError(e instanceof Error ? e.message : 'Fehler beim Senden');
    }
  };

  const handleRetryFailedRequest = () => {
    if (!failedRequestRef.current || sending) return;
    setEditingMessageId(null);
    void executeStudyAiRequest(failedRequestRef.current);
  };

  const handleStopGeneration = () => {
    if (!sending || !conversationKey) return;
    abortControllerRef.current?.abort();
    setSendError(null);
    failedRequestRef.current = null;
    const latestConversation = getConversation(conversationKey);
    const lastUser = [...latestConversation.messages].reverse().find((message) => message.role === 'user');
    if (lastUser) setEditingMessageId(lastUser.id);
  };

  const handleSubmitEditedMessage = (messageId: string, content: string) => {
    if (!conversationKey || sending) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    truncateAfterMessage(conversationKey, messageId);
    updateMessageContent(conversationKey, messageId, trimmed);
    setEditingMessageId(null);
    setSendError(null);
    const latestConversation = getConversation(conversationKey);
    const messagesForRequest = latestConversation.messages;
    void executeStudyAiRequest({
      messages: messagesForRequest,
      docId: latestConversation.docId,
      attemptImageDataUrl: null,
      requireAttemptImage: false,
    });
  };

  const handleRegenerate = () => {
    if (!conversationKey || conv.messages.length < 2) return;
    const last = conv.messages[conv.messages.length - 1];
    const prev = conv.messages[conv.messages.length - 2];
    if (last.role !== 'assistant' || prev.role !== 'user') return;
    const userContent = prev.content;
    removeLastTurn(conversationKey);
    void send(userContent);
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
    <div className="fixed inset-0 z-60 pointer-events-none">
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
            onRegenerate={handleRegenerate}
            onRetryFailedRequest={handleRetryFailedRequest}
            editingMessageId={editingMessageId}
            onStartEditMessage={setEditingMessageId}
            onCancelEditMessage={() => setEditingMessageId(null)}
            onSubmitEditMessage={handleSubmitEditedMessage}
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
        onStop={handleStopGeneration}
        onOpenCenter={() => {
          const panelView = useFloatingQuickLogPanelStore.getState().view;
          if (panelView === 'progressDetails' || panelView === 'review') {
            useFloatingQuickLogPanelStore.getState().setView('progress');
          }
          setUiMode(conversationKey, conv.messages.length > 0 ? 'floating' : 'center');
        }}
        onMaximize={() => {
          const panelView = useFloatingQuickLogPanelStore.getState().view;
          if (panelView === 'progressDetails' || panelView === 'review') {
            useFloatingQuickLogPanelStore.getState().setView('progress');
          }
          setUiMode(conversationKey, 'overlay');
        }}
        onClose={() => setUiMode(conversationKey, 'button')}
        onClear={() => clearConversation(conversationKey)}
        onRegenerate={handleRegenerate}
        onRetryFailedRequest={handleRetryFailedRequest}
        editingMessageId={editingMessageId}
        onStartEditMessage={setEditingMessageId}
        onCancelEditMessage={() => setEditingMessageId(null)}
        onSubmitEditMessage={handleSubmitEditedMessage}
      />
    </div>
  );
}
