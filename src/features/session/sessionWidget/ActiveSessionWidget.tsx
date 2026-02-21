import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoInformation } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { GhostButton } from '../../../components/Button';
import { studySessionRepo } from '../../../repositories';
import { useActiveSessionStore, type ActiveSession } from '../../../stores/activeSessionStore';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { formatDuration } from '../../../utils/time';
import type { SessionSummaryState } from '../modals/SessionReviewModal';
import { useStudyStore } from '../stores/studyStore';
import { formatTaskPath } from '../utils/formatTaskPath';
import { ActiveSessionInfoPanel } from './ActiveSessionInfoPanel';
import { getElapsedMs } from './utils';

export function ActiveSessionWidget(props: { active: ActiveSession }) {
  const { active } = props;
  const navigate = useNavigate();
  const { end } = useActiveSessionStore();
  const { studySessionId, reset, currentAttempt, taskDepthByAssetId, loadTaskDepth } =
    useStudyStore();

  const [expanded, setExpanded] = useState(false);

  const nowMs = useSessionClock(active);
  const { subjectName, topicName } = useSessionNames(active);
  const depth = currentAttempt?.assetId ? taskDepthByAssetId[currentAttempt.assetId] : undefined;

  useEffect(() => {
    if (!currentAttempt?.assetId) return;
    void loadTaskDepth(currentAttempt.assetId);
  }, [currentAttempt?.assetId, loadTaskDepth]);

  const secondaryLabel = useMemo(() => {
    if (!currentAttempt) return topicName ?? active.topicId;
    return `${formatTaskPath(currentAttempt, depth)}`;
  }, [active.topicId, currentAttempt, depth, topicName]);

  const { containerRef, pos } = useDraggablePosition({
    width: 200,
    initialTop: 24,
    initialRight: 24,
    padding: 8,
  });

  const elapsedMs = getElapsedMs(active, nowMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const timerLabel = useMemo(() => {
    if (!active.plannedDurationMs) return formatDuration(elapsedSeconds, true);
    const remainingSeconds = Math.ceil((active.plannedDurationMs - elapsedMs) / 1000);
    if (remainingSeconds >= 0) return formatDuration(remainingSeconds, true);
    return `+${formatDuration(Math.abs(remainingSeconds), true)}`;
  }, [active.plannedDurationMs, elapsedMs, elapsedSeconds]);

  const stopSession = useCallback(async () => {
    const endedAtMs = Date.now();
    const summary: SessionSummaryState = {
      studySessionId: studySessionId ?? undefined,
      subjectId: active.subjectId,
      topicId: active.topicId,
      startedAtMs: active.startedAtMs,
      endedAtMs,
    };
    if (studySessionId) await studySessionRepo.end(studySessionId, endedAtMs);
    end();
    reset();
    navigate(`/subjects/${active.subjectId}/topics/${active.topicId}`, {
      state: { sessionSummary: summary },
    });
  }, [active.subjectId, active.topicId, active.startedAtMs, end, navigate, reset, studySessionId]);

  return (
    <div
      ref={containerRef}
      className="fixed w-[200px] z-1000000000 max-w-[calc(100vw-32px)]"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="w-full h-full overflow-hidden rounded-full border bg-[#243957]/70 backdrop-blur shadow-lg dark:border-white/5">
        <div className="flex items-stretch p-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex text-sm  cursor-pointer min-w-0 flex-1 items-center px-2.5"
            aria-expanded={expanded}
          >
            <span className="tabular-nums font-medium">{timerLabel} · </span>
            <span className="truncate ml-1 opacity-70">{secondaryLabel}</span>
          </button>

          <GhostButton onClick={() => setExpanded((v) => !v)} icon={<IoInformation />} />
        </div>
      </div>

      <ActiveSessionInfoPanel
        open={expanded}
        active={active}
        subjectName={subjectName}
        topicName={topicName}
        elapsedSeconds={elapsedSeconds}
        onStop={stopSession}
      />
    </div>
  );
}

function useSessionClock(active: ActiveSession) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (active.pausedAtMs) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active.startedAtMs, active.pausedAtMs, active.pausedTotalMs, active.plannedDurationMs]);

  return nowMs;
}

function useSessionNames(active: ActiveSession) {
  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    void refreshBySubject(active.subjectId);
  }, [active.subjectId, refreshBySubject]);

  const subjectName = useMemo(() => {
    return subjects.find((s) => s.id === active.subjectId)?.name;
  }, [active.subjectId, subjects]);

  const topicName = useMemo(() => {
    const topics = topicsBySubject[active.subjectId] ?? [];
    return topics.find((t) => t.id === active.topicId)?.name;
  }, [active.subjectId, active.topicId, topicsBySubject]);

  return { subjectName, topicName };
}

function useDraggablePosition(input: {
  width: number;
  initialTop: number;
  initialRight: number;
  padding: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState(() => {
    const w = input.width;
    const x =
      typeof window === 'undefined'
        ? input.padding
        : Math.max(input.padding, window.innerWidth - w - input.initialRight);
    return { x, y: input.initialTop };
  });

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width ?? input.width;
      const h = rect?.height ?? 64;

      const nextX = d.originX + dx;
      const nextY = d.originY + dy;

      const padding = input.padding;
      const clampedX = Math.max(padding, Math.min(window.innerWidth - w - padding, nextX));
      const clampedY = Math.max(padding, Math.min(window.innerHeight - h - padding, nextY));
      setPos({ x: clampedX, y: clampedY });
    },
    [input.padding, input.width],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  return {
    containerRef,
    pos,
    gripProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
