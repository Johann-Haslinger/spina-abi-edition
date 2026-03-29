import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionDialog } from '../../../components/ActionDialog';
import { FullscreenViewerFrame } from '../../../components/FullscreenViewerFrame';
import { Modal } from '../../../components/Modal';
import { ViewerIconButton } from '../../../components/ViewerIconButton';
import type { Asset, AssetFile } from '../../../domain/models';
import { attemptRepo, assetFileStore, assetRepo, studySessionRepo } from '../../../repositories';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { useNotificationsStore } from '../../../stores/notificationsStore';
import { usePageSurfaceTheme, useSubjectAccentColor } from '../../../ui/hooks/useSubjectColors';
import { ErrorPage } from '../../common/ErrorPage';
import { NotFoundPage } from '../../common/NotFoundPage';
import { AiErrorReviewPanel } from '../components/AiErrorReviewPanel';
import { FloatingQuickLogPanel } from '../components/FloatingQuickLogPanel';
import { StudyAiWidget } from '../components/studyAi/StudyAiWidget';
import { ExerciseReviewModal } from '../modals/ExerciseReviewModal';
import type { SessionSummaryState } from '../modals/SessionReviewModal';
import { useStudyHudStore } from '../stores/studyHudStore';
import { useStudyStore } from '../stores/studyStore';
import { AssetViewer } from '../viewer/AssetViewer';

export function StudyPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { active, start, end } = useActiveSessionStore();
  const activeAttemptReview = useNotificationsStore((state) => state.activeAttemptReview);
  const closeAttemptReview = useNotificationsStore((state) => state.closeAttemptReview);

  const { asset, file, pdfData, loading, error } = useStudyAssetData(assetId);
  const [pageNumber, setPageNumber] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const [backDialogBusy, setBackDialogBusy] = useState(false);
  const [hadAttemptWhileOpen, setHadAttemptWhileOpen] = useState(false);
  const [endedAttemptCountOnOpen, setEndedAttemptCountOnOpen] = useState<number | null>(null);
  const subjectAccent = useSubjectAccentColor(asset?.subjectId);
  const pageSurfaceTheme = usePageSurfaceTheme(asset?.subjectId);

  const {
    boundSessionKey,
    studySessionId,
    bindToSession,
    ensureStudySession,
    loadExerciseStatus,
    setExerciseStatus,
    reset,
    currentAttempt,
    cancelAttempt,
  } = useStudyStore();

  const setStudyAiConversationKey = useStudyHudStore((s) => s.setStudyAiConversationKey);

  useEffect(() => {
    if (!active) return;
    bindToSession({
      subjectId: active.subjectId,
      topicId: active.topicId,
      startedAtMs: active.startedAtMs,
    });
  }, [active, bindToSession]);

  const guardState = useMemo(() => {
    if (!assetId) return { kind: 'notfound' as const };
    if (loading) return { kind: 'loading' as const };
    if (error) return { kind: 'error' as const, error };
    if (!asset) return { kind: 'notfound' as const };
    if (asset.type !== 'exercise') return { kind: 'notfound' as const };

    if (!active) {
      return { kind: 'needStart' as const, asset };
    }
    if (active.subjectId !== asset.subjectId || active.topicId !== asset.topicId) {
      return { kind: 'needSwitch' as const, asset };
    }
    return { kind: 'ok' as const, asset };
  }, [assetId, loading, error, asset, active]);

  const studyAiConversationKey = useMemo(() => {
    if (guardState.kind !== 'ok') return null;
    if (!boundSessionKey) return null;
    return `${boundSessionKey}:${guardState.asset.id}`;
  }, [boundSessionKey, guardState]);

  useEffect(() => {
    setStudyAiConversationKey(studyAiConversationKey);
    return () => setStudyAiConversationKey(null);
  }, [setStudyAiConversationKey, studyAiConversationKey]);

  useEffect(() => {
    if (guardState.kind !== 'ok') return;
    if (!active) return;
    void ensureStudySession({
      subjectId: active.subjectId,
      topicId: active.topicId,
      startedAtMs: active.startedAtMs,
      plannedDurationMs: active.plannedDurationMs,
    });
  }, [guardState.kind, active, ensureStudySession]);

  useEffect(() => {
    if (guardState.kind !== 'ok') return;
    void loadExerciseStatus(guardState.asset.id);
  }, [guardState.kind, guardState.asset, loadExerciseStatus]);

  useEffect(() => {
    setHadAttemptWhileOpen(false);
    setEndedAttemptCountOnOpen(null);
  }, [assetId, boundSessionKey]);

  useEffect(() => {
    if (currentAttempt?.assetId === assetId) setHadAttemptWhileOpen(true);
  }, [assetId, currentAttempt]);

  const assetForNav =
    guardState.kind === 'ok' || guardState.kind === 'needStart' || guardState.kind === 'needSwitch'
      ? guardState.asset
      : null;

  const goToAssetTopic = () => {
    if (!assetForNav) {
      navigate('/dashboard');
      return;
    }
    navigate(`/subjects/${assetForNav.subjectId}/topics/${assetForNav.topicId}`);
  };

  const endSessionAndGoToTopic = async () => {
    const endedAtMs = Date.now();
    const target = active ? `/subjects/${active.subjectId}/topics/${active.topicId}` : '/dashboard';
    const summary: SessionSummaryState | null = active
      ? {
          studySessionId: studySessionId ?? undefined,
          subjectId: active.subjectId,
          topicId: active.topicId,
          startedAtMs: active.startedAtMs,
          endedAtMs,
        }
      : null;
    if (studySessionId) await studySessionRepo.end(studySessionId, endedAtMs);
    end();
    reset();
    if (summary) navigate(target, { state: { sessionSummary: summary } });
    else navigate(target);
  };

  const getEndedAttemptCountForExercise = useCallback(async () => {
    if (!studySessionId) return 0;
    if (guardState.kind !== 'ok') return 0;
    const attempts = await attemptRepo.listForSessionAsset({
      studySessionId,
      assetId: guardState.asset.id,
    });
    return attempts.length;
  }, [guardState, studySessionId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (guardState.kind !== 'ok') {
        setEndedAttemptCountOnOpen(null);
        return;
      }

      if (!studySessionId) {
        setEndedAttemptCountOnOpen(0);
        return;
      }

      const count = await getEndedAttemptCountForExercise();
      if (!cancelled) setEndedAttemptCountOnOpen(count);
    })();

    return () => {
      cancelled = true;
    };
  }, [guardState.kind, studySessionId, getEndedAttemptCountForExercise]);

  const onPauseAndLeave = async () => {
    if (currentAttempt) cancelAttempt();
    setBackDialogOpen(false);
    setReviewOpen(false);

    const hasAttempts = (await getEndedAttemptCountForExercise()) > 0;
    if (!hasAttempts) {
      goToAssetTopic();
      return;
    }

    setReviewOpen(true);
  };

  const onFinishAndLeave = async () => {
    setBackDialogBusy(true);
    let navigateNow = false;
    try {
      if (currentAttempt) cancelAttempt();
      if (guardState.kind === 'ok') {
        await setExerciseStatus(guardState.asset.id, 'covered');
      }
      setBackDialogOpen(false);
      setReviewOpen(false);

      const hasAttempts = (await getEndedAttemptCountForExercise()) > 0;
      navigateNow = !hasAttempts;
      if (hasAttempts) setReviewOpen(true);
    } finally {
      setBackDialogBusy(false);
    }

    if (navigateNow) goToAssetTopic();
  };

  const onBackClick = () => {
    if (guardState.kind !== 'ok') {
      goToAssetTopic();
      return;
    }

    void (async () => {
      const endedAttemptCountNow = await getEndedAttemptCountForExercise();
      const hasEndedAttemptWhileOpen =
        endedAttemptCountNow > (endedAttemptCountOnOpen ?? endedAttemptCountNow);
      const hasRunningAttemptForAsset = currentAttempt?.assetId === guardState.asset.id;

      if (!hasEndedAttemptWhileOpen && !hasRunningAttemptForAsset && !hadAttemptWhileOpen) {
        goToAssetTopic();
        return;
      }
      setBackDialogOpen(true);
    })();
  };

  if (guardState.kind === 'notfound') return <NotFoundPage />;
  if (guardState.kind === 'loading')
    return (
      <FullscreenViewerFrame surfaceTheme={pageSurfaceTheme}>
        <div className="absolute inset-0 grid place-items-center">
          <div
            role="status"
            aria-label="Lädt"
            className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400/60 border-t-transparent"
          />
        </div>
      </FullscreenViewerFrame>
    );
  if (guardState.kind === 'error')
    return <ErrorPage title="Fehler beim Laden" message={guardState.error} />;

  return (
    <FullscreenViewerFrame
      surfaceTheme={pageSurfaceTheme}
      overlayLeft={
        <ViewerIconButton
          ariaLabel="Zurück"
          onClick={onBackClick}
          className="border-white/10 bg-(--app-floating-bg) text-white hover:bg-(--app-floating-solid-bg) active:bg-(--app-floating-solid-bg)"
        >
          <IoChevronBack />
        </ViewerIconButton>
      }
    >
      <ActionDialog
        open={backDialogOpen}
        onClose={() => setBackDialogOpen(false)}
        busy={backDialogBusy}
        title="Übung verlassen?"
        message={
          currentAttempt
            ? 'Möchtest du die Übung abschließen oder pausieren? Der laufende Versuch wird dabei abgebrochen.'
            : 'Möchtest du die Übung abschließen oder pausieren?'
        }
        actions={[
          {
            key: 'cancel',
            label: 'Abbrechen',
            tone: 'neutral',
            onClick: () => setBackDialogOpen(false),
          },
          {
            key: 'pause',
            label: 'Übung pausieren',
            tone: 'neutral',
            onClick: onPauseAndLeave,
          },
          {
            key: 'finish',
            label: 'Übung abschließen',
            tone: 'primary',
            onClick: () => void onFinishAndLeave(),
          },
        ]}
      />

      <Modal
        open={guardState.kind === 'needStart'}
        onClose={goToAssetTopic}
        footer={
          <>
            <button
              type="button"
              onClick={goToAssetTopic}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                const a = guardState.asset;
                start({ subjectId: a.subjectId, topicId: a.topicId });
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Starten
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-300">
          Diese Übung gehört zu einem Thema. Für Tracking musst du eine Session starten.
        </div>
      </Modal>

      <Modal
        open={guardState.kind === 'needSwitch'}
        onClose={goToAssetTopic}
        footer={
          <>
            <button
              type="button"
              onClick={goToAssetTopic}
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                const a = guardState.asset;
                end();
                start({ subjectId: a.subjectId, topicId: a.topicId });
              }}
              className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Wechseln
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-300">
          Diese Übung gehört zu einem anderen Thema als deine aktive Session.
        </div>
      </Modal>

      {guardState.kind === 'ok' ? (
        file ? (
          <>
            <AssetViewer
              title={guardState.asset.title}
              file={file}
              pdfData={pdfData}
              pageNumber={pageNumber}
              onPageNumberChange={setPageNumber}
              accentColor={subjectAccent}
              ink={
                studySessionId
                  ? {
                      studySessionId,
                      assetId: guardState.asset.id,
                      activeAttemptId: currentAttempt?.attemptId ?? null,
                      studyAiConversationKey: boundSessionKey
                        ? `${boundSessionKey}:${guardState.asset.id}`
                        : null,
                    }
                  : null
              }
            />

            <FloatingQuickLogPanel
              assetId={guardState.asset.id}
              pageNumber={pageNumber}
              subjectId={guardState.asset.subjectId}
              topicId={guardState.asset.topicId}
              pdfData={pdfData}
              onOpenExerciseReview={() => setReviewOpen(true)}
            />

            <StudyAiWidget
              assetId={guardState.asset.id}
              pdfData={pdfData}
              boundSessionKey={boundSessionKey}
              currentAttemptId={currentAttempt?.attemptId ?? null}
            />

            <AiErrorReviewPanel
              attemptId={
                activeAttemptReview?.assetId === guardState.asset.id
                  ? activeAttemptReview.attemptId
                  : null
              }
              onClose={closeAttemptReview}
            />
          </>
        ) : (
          <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            Datei nicht gefunden (local file missing).
          </div>
        )
      ) : null}

      {guardState.kind === 'ok' ? (
        <ExerciseReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          studySessionId={studySessionId}
          assetId={guardState.asset.id}
          onGoToTopic={() => {
            setReviewOpen(false);
            goToAssetTopic();
          }}
          onEndSession={async () => {
            setReviewOpen(false);
            await endSessionAndGoToTopic();
          }}
        />
      ) : null}
    </FullscreenViewerFrame>
  );
}

function useStudyAssetData(assetId: string | undefined) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<AssetFile | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!assetId) return;
      setLoading(true);
      setError(null);
      try {
        const a = await assetRepo.get(assetId);
        if (!cancelled) setAsset(a ?? null);

        if (a) {
          const f = await assetFileStore.get(a.id);
          if (!cancelled && f) {
            setFile(f);
            const isPdf =
              f.mimeType === 'application/pdf' || f.originalName.toLowerCase().endsWith('.pdf');
            if (isPdf) {
              const buf = await f.blob.arrayBuffer();
              setPdfData(new Uint8Array(buf).slice(0));
            } else {
              setPdfData(null);
            }
          } else if (!cancelled) {
            setFile(null);
            setPdfData(null);
          }
        } else if (!cancelled) {
          setFile(null);
          setPdfData(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return { asset, file, pdfData, loading, error };
}
