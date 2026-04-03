import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionDialog } from '../../../components/ActionDialog';
import { renderAttemptCompositePngDataUrl } from '../../../ink/attemptComposite';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { startAttemptAutoReview } from '../review/processAttemptReview';
import { useFloatingQuickLogPanelStore } from '../stores/floatingQuickLogPanelStore';
import { useStudyAiChatStore } from '../stores/studyAiChatStore';
import { useStudyHudStore, useStudyHudVisibility } from '../stores/studyHudStore';
import { useStudyStore } from '../stores/studyStore';
import { ConfigView } from './floatingQuickLogPanel/ConfigView';
import { NextView } from './floatingQuickLogPanel/NextView';
import { ProgressDetailsView } from './floatingQuickLogPanel/ProgressDetailsView';
import { ProgressView } from './floatingQuickLogPanel/ProgressView.tsx';
import { ReviewView } from './floatingQuickLogPanel/ReviewView';
import { StartView } from './floatingQuickLogPanel/StartView.tsx';
import { incrementSuffix } from './floatingQuickLogPanel/stepperSuffix';
import { HUD_VARIANTS_BOTTOM_RIGHT } from './studyHud/hudMotion';

type PanelView = 'start' | 'config' | 'progress' | 'progressDetails' | 'review' | 'next';

export function FloatingQuickLogPanel(props: {
  assetId: string;
  pageNumber: number;
  subjectId: string;
  topicId: string;
  pdfData: Uint8Array | null;
  onOpenExerciseReview: () => void;
}) {
  const { suppressNonStudyAi } = useStudyHudVisibility();

  const view = useFloatingQuickLogPanelStore((s) => s.view) as PanelView;
  const setViewRaw = useFloatingQuickLogPanelStore((s) => s.setView) as (v: PanelView) => void;

  const setView = useCallback(
    (newView: PanelView) => {
      if (newView === 'progressDetails' || newView === 'review') {
        const key = useStudyHudStore.getState().studyAiConversationKey;
        if (key) {
          const mode = useStudyAiChatStore.getState().uiByConversation[key]?.mode ?? 'button';
          if (mode === 'overlay' || mode === 'floating') {
            useStudyAiChatStore.getState().setUiMode(key, 'button');
          }
        }
      }
      setViewRaw(newView);
    },
    [setViewRaw],
  );
  const storedX = useFloatingQuickLogPanelStore((s) => s.x);
  const storedY = useFloatingQuickLogPanelStore((s) => s.y);
  const setPosition = useFloatingQuickLogPanelStore((s) => s.setPosition);

  const active = useActiveSessionStore((s) => s.active);
  const {
    problemIdx,
    subproblemLabel,
    subsubproblemLabel,
    ensureStudySession,
    setProblemIdx,
    setSubproblemLabel,
    setSubsubproblemLabel,
    cancelAttempt,
    logAttempt,
    setExerciseStatus,
    currentAttempt,
    taskDepthByAssetId,
    loadTaskDepth,
  } = useStudyStore();

  const dragControls = useDragControls();
  const x = useMotionValue(storedX);
  const y = useMotionValue(storedY);
  const [finishExerciseDialogOpen, setFinishExerciseDialogOpen] = useState(false);

  const { viewHeightPx, viewWidthPx } = usePanelDimensions();

  useResetPanelViewOnAttemptEnd({ currentAttempt, view, setView });
  useLoadAssetTaskDepth({ assetId: props.assetId, loadTaskDepth });

  const depth = taskDepthByAssetId[props.assetId] ?? 2;

  const finishAttempt = useCallback(async () => {
    if (!active) throw new Error('Keine aktive Session');
    if (!currentAttempt) throw new Error('Kein laufender Versuch');

    if (!props.pdfData) {
      setView('review');
      return;
    }

    let attemptImageDataUrl: string;
    try {
      attemptImageDataUrl = await renderAttemptCompositePngDataUrl({
        attemptId: currentAttempt.attemptId,
        pdfData: props.pdfData,
        maxPdfBytes: 12 * 1024 * 1024,
        maxOutputPixels: 12_000_000,
      });
    } catch {
      setView('review');
      return;
    }

    await ensureStudySession({
      subjectId: active.subjectId,
      topicId: active.topicId,
      startedAtMs: active.startedAtMs,
      plannedDurationMs: active.plannedDurationMs,
    });
    const logged = await logAttempt({
      assetId: props.assetId,
      problemIdx,
      subproblemLabel,
      subsubproblemLabel,
      endedAtMs: Date.now(),
      result: 'partial',
      reviewStatus: 'queued',
    });
    setView('next');
    startAttemptAutoReview({
      attemptId: logged.attemptId,
      assetId: props.assetId,
      subjectId: props.subjectId,
      topicId: props.topicId,
      pdfData: props.pdfData,
      problemIdx: logged.problemIdx,
      subproblemLabel: logged.subproblemLabel,
      subsubproblemLabel: logged.subsubproblemLabel,
      attemptImageDataUrl,
    });
  }, [
    active,
    currentAttempt,
    ensureStudySession,
    logAttempt,
    problemIdx,
    props.assetId,
    props.pdfData,
    props.subjectId,
    props.topicId,
    setView,
    subproblemLabel,
    subsubproblemLabel,
  ]);

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
    <div className="fixed inset-0 z-9999 pointer-events-none">
      <ActionDialog
        open={finishExerciseDialogOpen}
        onClose={() => setFinishExerciseDialogOpen(false)}
        title="Übung beenden?"
        message="Möchtest du die Übung jetzt beenden oder lieber weiter üben?"
        actions={[
          {
            key: 'continue',
            label: 'Weiter üben',
            tone: 'neutral',
            onClick: () => setFinishExerciseDialogOpen(false),
          },
          {
            key: 'finish',
            label: 'Beenden',
            tone: 'primary',
            onClick: async () => {
              await setExerciseStatus(props.assetId, 'covered');
              props.onOpenExerciseReview();
              setFinishExerciseDialogOpen(false);
              setView('start');
            },
          },
        ]}
      />
      <motion.div
        className="absolute bottom-6 right-6 pointer-events-auto touch-none"
        variants={HUD_VARIANTS_BOTTOM_RIGHT}
        initial="hidden"
        animate={suppressNonStudyAi ? 'hidden' : 'shown'}
        exit="hidden"
        aria-hidden={suppressNonStudyAi}
        style={{ pointerEvents: suppressNonStudyAi ? 'none' : 'auto' }}
      >
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 8, left: 8, right: 8, bottom: 8 }}
          dragElastic={0}
          dragMomentum={false}
          style={{ x, y, width: viewWidthPx[view] }}
          animate={{ width: viewWidthPx[view] }}
          transition={{ type: 'spring', stiffness: 520, damping: 44 }}
          onDragEnd={() => setPosition({ x: x.get(), y: y.get() })}
        >
          <motion.div
            animate={{
              height: viewHeightPx[view],
            }}
            transition={{ type: 'spring', stiffness: 520, damping: 44 }}
            className="relative w-full overflow-hidden rounded-4xl border backdrop-blur shadow-lg dark:border-white/5"
            style={{
              height: viewHeightPx[view],
              backgroundColor: 'var(--app-floating-bg)',
            }}
          >
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={view}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1, padding: view === 'progress' ? 12 : 20 }}
                exit={{ opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                style={{ willChange: 'opacity, transform' }}
              >
                <div className="h-full">
                  {view === 'start' ? (
                    <StartView
                      assetId={props.assetId}
                      pageNumber={props.pageNumber}
                      gripProps={gripProps}
                      subjectId={props.subjectId}
                      topicId={props.topicId}
                      onStarted={() => setView('progress')}
                      onOpenConfig={() => setView('config')}
                    />
                  ) : null}

                  {view === 'config' ? (
                    <ConfigView
                      assetId={props.assetId}
                      gripProps={gripProps}
                      onClose={() => setView('start')}
                    />
                  ) : null}

                  {view === 'progress' ? (
                    <ProgressView
                      gripProps={gripProps}
                      onOpenDetails={() => setView('progressDetails')}
                      onFinish={() => void finishAttempt()}
                    />
                  ) : null}

                  {view === 'progressDetails' ? (
                    <ProgressDetailsView
                      gripProps={gripProps}
                      onClose={() => setView('progress')}
                      onFinish={() => void finishAttempt()}
                      onCancel={() => {
                        cancelAttempt();
                        setView('start');
                      }}
                    />
                  ) : null}

                  {view === 'review' ? (
                    <ReviewView
                      gripProps={gripProps}
                      onClose={() => setView('progress')}
                      onSave={async (input) => {
                        if (!active) throw new Error('Keine aktive Session');
                        await ensureStudySession({
                          subjectId: active.subjectId,
                          topicId: active.topicId,
                          startedAtMs: active.startedAtMs,
                          plannedDurationMs: active.plannedDurationMs,
                        });
                        await logAttempt({
                          assetId: props.assetId,
                          problemIdx,
                          subproblemLabel,
                          endedAtMs: Date.now(),
                          result: input.result,
                          note: input.note,
                          errorType: input.errorType,
                        });
                        setView('next');
                      }}
                    />
                  ) : null}

                  {view === 'next' ? (
                    <NextView
                      gripProps={gripProps}
                      taskDepth={depth}
                      onNextSubproblem={() => {
                        if (depth === 3) {
                          setSubsubproblemLabel(
                            incrementSuffix((subsubproblemLabel || '1').trim()) || '1',
                          );
                        } else {
                          setSubproblemLabel(
                            incrementSuffix((subproblemLabel || 'a').trim()) || 'a',
                          );
                        }
                        setView('start');
                      }}
                      onNewProblem={() => {
                        setProblemIdx(problemIdx + 1);
                        setSubproblemLabel('a');
                        setSubsubproblemLabel('1');
                        setView('start');
                      }}
                      onMarkProgress={() => {
                        props.onOpenExerciseReview();
                        setView('start');
                      }}
                      onFinishExercise={() => setFinishExerciseDialogOpen(true)}
                    />
                  ) : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function usePanelDimensions() {
  const viewHeightPx: Record<PanelView, number> = useMemo(
    () => ({
      start: 310,
      config: 290,
      progress: 64,
      progressDetails: 360,
      review: 360,
      next: 320,
    }),
    [],
  );

  const viewWidthPx: Record<PanelView, number> = useMemo(
    () => ({
      start: 256,
      config: 246,
      progress: 154,
      progressDetails: 256,
      review: 256,
      next: 256,
    }),
    [],
  );

  return { viewHeightPx, viewWidthPx };
}

function useResetPanelViewOnAttemptEnd(input: {
  currentAttempt: unknown;
  view: PanelView;
  setView: (v: PanelView) => void;
}) {
  const { currentAttempt, view, setView } = input;
  useEffect(() => {
    if (!currentAttempt) {
      if (view === 'progress' || view === 'progressDetails' || view === 'review') {
        setView('start');
      }
    }
  }, [currentAttempt, setView, view]);
}

function useLoadAssetTaskDepth(input: {
  assetId: string;
  loadTaskDepth: (assetId: string) => Promise<void>;
}) {
  const { assetId, loadTaskDepth } = input;
  useEffect(() => {
    if (!assetId) return;
    void loadTaskDepth(assetId);
  }, [assetId, loadTaskDepth]);
}
