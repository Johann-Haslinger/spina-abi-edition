import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useActiveSessionStore } from '../../../stores/activeSessionStore';
import { useFloatingQuickLogPanelStore } from '../stores/floatingQuickLogPanelStore';
import { useStudyStore } from '../stores/studyStore';
import { NextView } from './floatingQuickLogPanel/NextView';
import { ProgressDetailsView } from './floatingQuickLogPanel/ProgressDetailsView';
import { ProgressView } from './floatingQuickLogPanel/ProgressView.tsx';
import { ReviewView } from './floatingQuickLogPanel/ReviewView';
import { StartView } from './floatingQuickLogPanel/StartView.tsx';

type PanelView = 'start' | 'progress' | 'progressDetails' | 'review' | 'next';

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
    ensureStudySession,
    setProblemIdx,
    setSubproblemLabel,
    cancelAttempt,
    logAttempt,
    setExerciseStatus,
    currentAttempt,
  } = useStudyStore();

  const dragControls = useDragControls();
  const x = useMotionValue(storedX);
  const y = useMotionValue(storedY);

  const viewHeightPx: Record<PanelView, number> = useMemo(
    () => ({
      start: 280,
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
      progress: 154,
      progressDetails: 256,
      review: 256,
      next: 256,
    }),
    [],
  );

  useEffect(() => {
    if (!currentAttempt) {
      if (view === 'progress' || view === 'progressDetails' || view === 'review') {
        setView('start');
      }
    }
  }, [currentAttempt, setView, view]);

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
        className="absolute bottom-4 right-4 pointer-events-auto touch-none"
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
              animate={{ opacity: 1, scale: 1, padding: view === 'progress' ? 12 : 24 }}
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
                    onNextSubproblem={() => {
                      setSubproblemLabel(nextLabelWrap(subproblemLabel));
                      setView('start');
                    }}
                    onNewProblem={() => {
                      setProblemIdx(problemIdx + 1);
                      setSubproblemLabel('a');
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

function nextLabelWrap(label: string) {
  const l = label.trim();
  if (l.length !== 1) return l || 'a';
  const c = l.toLowerCase().charCodeAt(0);
  if (c < 97 || c > 122) return l;
  if (c === 122) return 'a';
  return String.fromCharCode(c + 1);
}
