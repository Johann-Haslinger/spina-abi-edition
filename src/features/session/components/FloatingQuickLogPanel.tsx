import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { useFloatingQuickLogPanelStore } from '../stores/floatingQuickLogPanelStore';
import { useStudyStore } from '../stores/studyStore';
import { ConfigView } from './floatingQuickLogPanel/ConfigView';
import { NextView } from './floatingQuickLogPanel/NextView';
import { ProgressDetailsView } from './floatingQuickLogPanel/ProgressDetailsView';
import { ProgressView } from './floatingQuickLogPanel/ProgressView.tsx';
import { ReviewView } from './floatingQuickLogPanel/ReviewView';
import { StartView } from './floatingQuickLogPanel/StartView.tsx';
import { incrementSuffix } from './floatingQuickLogPanel/stepperSuffix';

type PanelView = 'start' | 'config' | 'progress' | 'progressDetails' | 'review' | 'next';

export function FloatingQuickLogPanel(props: {
  assetId: string;
  pageNumber: number;
  subjectId: string;
  topicId: string;
  onOpenExerciseReview: () => void;
}) {
  const view = useFloatingQuickLogPanelStore((s) => s.view) as PanelView;
  const setView = useFloatingQuickLogPanelStore((s) => s.setView) as (v: PanelView) => void;
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

  const { viewHeightPx, viewWidthPx } = usePanelDimensions();

  useResetPanelViewOnAttemptEnd({ currentAttempt, view, setView });
  useLoadAssetTaskDepth({ assetId: props.assetId, loadTaskDepth });

  const depth = taskDepthByAssetId[props.assetId] ?? 2;

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
      <motion.div
        className="absolute bottom-6 right-6 pointer-events-auto touch-none"
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
          style={{ height: viewHeightPx[view] }}
          className="relative w-full overflow-hidden rounded-4xl border bg-[#243957]/70 backdrop-blur shadow-lg dark:border-white/5"
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
                    onFinish={() => setView('review')}
                  />
                ) : null}

                {view === 'progressDetails' ? (
                  <ProgressDetailsView
                    gripProps={gripProps}
                    onClose={() => setView('progress')}
                    onFinish={() => setView('review')}
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
                        setSubproblemLabel(incrementSuffix((subproblemLabel || 'a').trim()) || 'a');
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
                    onFinishExercise={async () => {
                      await setExerciseStatus(props.assetId, 'covered');
                      props.onOpenExerciseReview();
                      setView('start');
                    }}
                  />
                ) : null}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

function usePanelDimensions() {
  const viewHeightPx: Record<PanelView, number> = useMemo(
    () => ({
      start: 310,
      config: 280,
      progress: 64,
      progressDetails: 240,
      review: 360,
      next: 320,
    }),
    [],
  );

  const viewWidthPx: Record<PanelView, number> = useMemo(
    () => ({
      start: 256,
      config: 220,
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
  useEffect(() => {
    if (!input.currentAttempt) {
      if (
        input.view === 'progress' ||
        input.view === 'progressDetails' ||
        input.view === 'review'
      ) {
        input.setView('start');
      }
    }
  }, [input.currentAttempt, input.setView, input.view]);
}

function useLoadAssetTaskDepth(input: {
  assetId: string;
  loadTaskDepth: (assetId: string) => Promise<void>;
}) {
  useEffect(() => {
    if (!input.assetId) return;
    void input.loadTaskDepth(input.assetId);
  }, [input.assetId, input.loadTaskDepth]);
}
