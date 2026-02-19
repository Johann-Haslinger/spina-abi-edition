import { GripVertical } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoStop } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { studySessionRepo } from '../../../repositories';
import { useActiveSessionStore, type ActiveSession } from '../../../stores/activeSessionStore';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { useSubjectAccentColor } from '../../../ui/hooks/useSubjectColors';
import { formatDurationClock } from '../../../utils/time';
import type { SessionSummaryState } from '../modals/SessionReviewModal';
import { useStudyStore } from '../stores/studyStore';
import { ActiveSessionInfoPanel } from './ActiveSessionInfoPanel';
import { getElapsedMs } from './utils';

export function ActiveSessionWidget(props: { active: ActiveSession }) {
  const { active } = props;
  const navigate = useNavigate();
  const { end } = useActiveSessionStore();
  const { studySessionId, reset } = useStudyStore();
  const subjectColor = useSubjectAccentColor(active.subjectId);

  const [expanded, setExpanded] = useState(false);

  const nowMs = useSessionClock(active);
  const { subjectName, topicName } = useSessionNames(active);

  const { containerRef, pos, gripProps } = useDraggablePosition({
    width: 200,
    initialTop: 12,
    initialRight: 12,
    padding: 8,
  });

  const elapsedMs = getElapsedMs(active, nowMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const timerLabel = useMemo(() => {
    if (!active.plannedDurationMs) return formatDurationClock(elapsedSeconds);
    const remainingSeconds = Math.ceil((active.plannedDurationMs - elapsedMs) / 1000);
    if (remainingSeconds >= 0) return formatDurationClock(remainingSeconds);
    return `+${formatDurationClock(Math.abs(remainingSeconds))}`;
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
            style={{ backgroundColor: subjectColor }}
            type="button"
            onClick={() => void stopSession()}
            className="inline-flex cursor-pointer size-8 items-center justify-center rounded-full text-white dark:bg-white/5! dark:text-white/80"
            aria-label="Stop"
            title="Session beenden"
          >
            <IoStop className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex cursor-pointer min-w-0 flex-1 flex-col justify-center rounded-lg px-2.5 text-left"
            aria-expanded={expanded}
          >
            <div className="tabular-nums leading-3.7 text-xs font-bold">{timerLabel}</div>
            <div className="truncate text-xs opacity-70 leading-3.7">
              {topicName ?? active.topicId}
            </div>
          </button>

          <button
            type="button"
            className="inline-flex pr-1.5 items-center justify-center text-black/70 hover:text-black/90 dark:text-white/60 cursor-grab active:cursor-grabbing"
            aria-label="Verschieben"
            title="Ziehen zum Verschieben"
            {...gripProps}
          >
            <GripVertical className="size-5" />
          </button>
        </div>
      </div>

      <ActiveSessionInfoPanel
        open={expanded}
        active={active}
        subjectName={subjectName}
        topicName={topicName}
        elapsedSeconds={elapsedSeconds}
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
