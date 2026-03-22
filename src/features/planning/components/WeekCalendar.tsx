import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEntry } from '../utils/planning';
import { addDaysMs, formatCalendarTimeRange } from '../utils/planning';

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 22;
const GRID_ROW_MINUTES = 30;
const ROW_HEIGHT_PX = 28;
const DRAG_THRESHOLD_PX = 6;

type Segment = CalendarEntry & {
  segmentId: string;
  dayIndex: number;
  segmentStartAtMs: number;
  segmentDurationMs: number;
  laneIdx: number;
  clusterSize: number;
};

type DraftSelection = {
  dayIndex: number;
  pointerId: number;
  startMin: number;
  currentMin: number;
};

type DragInteraction = {
  mode: 'move' | 'resize';
  pointerId: number;
  segmentId: string;
  occurrenceStartAtMs: number;
  originDayIndex: number;
  dayWidthPx: number;
  originClientX: number;
  originClientY: number;
  originStartMin: number;
  originDurationMin: number;
  previewDayIndex: number;
  previewStartMin: number;
  previewDurationMin: number;
  didDrag: boolean;
};

function getMinutesSinceMidnight(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export function WeekCalendar(props: {
  weekStartMs: number;
  entries: CalendarEntry[];
  onEntryClick?: (entry: CalendarEntry) => void;
  onCreateRange?: (startAtMs: number, durationMs: number) => void;
  onPlannedEntryChange?: (
    entry: CalendarEntry,
    patch: { startAtMs?: number; durationMs?: number },
  ) => void | Promise<void>;
}) {
  const { weekStartMs, entries, onEntryClick, onCreateRange, onPlannedEntryChange } = props;

  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [drag, setDrag] = useState<DragInteraction | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const suppressClickEntryIdRef = useRef<string | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(pointer: coarse)');
    const sync = () => setIsCoarsePointer(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!isCoarsePointer || !drag) return;

    const previousTouchAction = document.body.style.touchAction;
    const previousOverflow = document.body.style.overflow;
    document.body.style.touchAction = 'none';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.touchAction = previousTouchAction;
      document.body.style.overflow = previousOverflow;
    };
  }, [drag, isCoarsePointer]);

  const gridDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const startMs = addDaysMs(weekStartMs, i);
        const endMs = addDaysMs(weekStartMs, i + 1);
        return { startMs, endMs };
      }),
    [weekStartMs],
  );

  const segmentsByDay = useMemo(() => {
    const segments: Segment[] = [];

    for (const entry of entries) {
      const eventStart = entry.startAtMs;
      const eventEnd = entry.startAtMs + entry.durationMs;
      if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventEnd <= eventStart) {
        continue;
      }

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = gridDays[dayIndex];
        if (eventEnd <= day.startMs || eventStart >= day.endMs) continue;

        const segStart = Math.max(eventStart, day.startMs);
        const segEnd = Math.min(eventEnd, day.endMs);
        const segDuration = Math.max(0, segEnd - segStart);
        if (segDuration <= 0) continue;

        segments.push({
          ...entry,
          segmentId: `${entry.id}_${dayIndex}_${segStart}`,
          dayIndex,
          segmentStartAtMs: segStart,
          segmentDurationMs: segDuration,
          laneIdx: 0,
          clusterSize: 1,
        });
      }
    }

    const byDay = Array.from({ length: 7 }, () => [] as Segment[]);
    for (const segment of segments) byDay[segment.dayIndex].push(segment);

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const daySegments = byDay[dayIndex];
      daySegments.sort((a, b) => a.segmentStartAtMs - b.segmentStartAtMs);

      const laneEndTimes: number[] = [];
      for (const segment of daySegments) {
        let laneIdx = 0;
        for (; laneIdx < laneEndTimes.length; laneIdx++) {
          if (segment.segmentStartAtMs >= laneEndTimes[laneIdx]) break;
        }
        if (laneIdx === laneEndTimes.length) {
          laneEndTimes.push(segment.segmentStartAtMs + segment.segmentDurationMs);
        } else {
          laneEndTimes[laneIdx] = segment.segmentStartAtMs + segment.segmentDurationMs;
        }
        segment.laneIdx = laneIdx;
      }

      if (daySegments.length === 0) continue;

      let groupStartIdx = 0;
      let groupEndAt = daySegments[0].segmentStartAtMs + daySegments[0].segmentDurationMs;
      const finalizeGroup = (startIdx: number, endIdx: number) => {
        const clusterSize = daySegments
          .slice(startIdx, endIdx)
          .reduce((max, segment) => Math.max(max, segment.laneIdx + 1), 1);
        for (let idx = startIdx; idx < endIdx; idx++) {
          daySegments[idx].clusterSize = clusterSize;
        }
      };

      for (let idx = 1; idx < daySegments.length; idx++) {
        const segment = daySegments[idx];
        const segmentEndAt = segment.segmentStartAtMs + segment.segmentDurationMs;
        if (segment.segmentStartAtMs >= groupEndAt) {
          finalizeGroup(groupStartIdx, idx);
          groupStartIdx = idx;
          groupEndAt = segmentEndAt;
          continue;
        }

        groupEndAt = Math.max(groupEndAt, segmentEndAt);
      }

      finalizeGroup(groupStartIdx, daySegments.length);
    }

    return byDay;
  }, [entries, gridDays]);

  const gridHeightPx =
    (((GRID_END_HOUR - GRID_START_HOUR) * 60) / GRID_ROW_MINUTES) * ROW_HEIGHT_PX;
  const gridStartMin = GRID_START_HOUR * 60;
  const gridEndMin = GRID_END_HOUR * 60;

  function clampToGrid(minutes: number) {
    return Math.max(gridStartMin, Math.min(gridEndMin, minutes));
  }

  function snapToSlot(minutes: number) {
    return Math.round(minutes / GRID_ROW_MINUTES) * GRID_ROW_MINUTES;
  }

  function pointerToMinutes(clientY: number, element: HTMLDivElement) {
    const rect = element.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const rawMinutes = gridStartMin + ratio * (gridEndMin - gridStartMin);
    return clampToGrid(snapToSlot(rawMinutes));
  }

  function rangeFromDraft(dayIndex: number, startMin: number, endMin: number) {
    const minStart = Math.max(gridStartMin, Math.min(startMin, endMin));
    const maxEnd = Math.min(gridEndMin, Math.max(startMin, endMin));
    const snappedStart = snapToSlot(minStart);
    const snappedEnd = snapToSlot(maxEnd);
    const durationMin = Math.max(GRID_ROW_MINUTES, snappedEnd - snappedStart);
    return {
      startAtMs: addDaysMs(weekStartMs, dayIndex) + snappedStart * 60_000,
      durationMs: durationMin * 60_000,
      topPx: ((snappedStart - gridStartMin) / GRID_ROW_MINUTES) * ROW_HEIGHT_PX,
      heightPx: (durationMin / GRID_ROW_MINUTES) * ROW_HEIGHT_PX,
    };
  }

  function dayIndexFromDelta(originDayIndex: number, deltaX: number, dayWidthPx: number) {
    const rawDeltaDays = Math.round(deltaX / Math.max(1, dayWidthPx));
    return Math.max(0, Math.min(6, originDayIndex + rawDeltaDays));
  }

  function minutesFromDelta(deltaY: number) {
    return snapToSlot((deltaY / ROW_HEIGHT_PX) * GRID_ROW_MINUTES);
  }

  function toStartAtMs(dayIndex: number, startMin: number) {
    return addDaysMs(weekStartMs, dayIndex) + startMin * 60_000;
  }

  const hourLabels = useMemo(() => {
    const out: Array<{ hour: number; label: string; topPx: number }> = [];
    for (let hour = GRID_START_HOUR; hour <= GRID_END_HOUR; hour++) {
      out.push({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        topPx: ((hour * 60 - gridStartMin) / GRID_ROW_MINUTES) * ROW_HEIGHT_PX,
      });
    }
    return out;
  }, [gridStartMin]);

  const todayDayIndex = useMemo(() => {
    const today = new Date(nowMs);
    const weekStart = new Date(weekStartMs);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const weekStartDay = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate(),
    ).getTime();
    const diffDays = Math.round((todayStart - weekStartDay) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 && diffDays < 7 ? diffDays : -1;
  }, [nowMs, weekStartMs]);

  const nowTopPx = useMemo(() => {
    const nowMinutes = getMinutesSinceMidnight(nowMs);
    if (nowMinutes < gridStartMin || nowMinutes > gridEndMin) return null;
    return ((nowMinutes - gridStartMin) / GRID_ROW_MINUTES) * ROW_HEIGHT_PX;
  }, [nowMs, gridStartMin, gridEndMin]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain [WebkitOverflowScrolling:touch]">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[76px_repeat(7,minmax(0,1fr))]">
            <div className="sticky top-0 z-30 h-12 border-b border-slate-700/60 bg-slate-950/95 backdrop-blur" />
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(addDaysMs(weekStartMs, i));
            const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const isToday = i === todayDayIndex;

            return (
              <div
                key={i}
                className={`sticky top-0 z-30 flex h-12 flex-col justify-center border-b border-slate-700/60 px-2 backdrop-blur ${
                  isToday ? 'bg-rose-500/8' : ''
                }`}
                style={{ backgroundColor: isToday ? undefined : 'rgba(2, 6, 23, 0.95)' }}
              >
                <div
                  className={`text-xs font-semibold ${isToday ? 'text-rose-300' : 'text-slate-300'}`}
                >
                  {weekday}
                </div>
                <div className={`text-xs ${isToday ? 'text-rose-200' : 'text-slate-400'}`}>
                  {day}.{month}
                </div>
              </div>
            );
          })}

            <div className="relative" style={{ height: gridHeightPx }}>
            {hourLabels.map((hour) => (
              <div
                key={hour.hour}
                className="absolute left-0 right-0 -ml-1 pr-2 text-[11px] text-slate-500 text-right"
                style={{ top: hour.topPx - 6 }}
              >
                {hour.label}
              </div>
            ))}
            </div>

          {Array.from({ length: 7 }, (_, dayIndex) => {
            const daySegments = segmentsByDay[dayIndex];
            const isToday = dayIndex === todayDayIndex;

            return (
              <div
                key={dayIndex}
                className={`relative border-b border-slate-800/20 ${isToday ? 'bg-rose-500/5' : ''}`}
                style={{ height: gridHeightPx }}
              >
                {isToday && nowTopPx !== null ? (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: nowTopPx }}
                  >
                    <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(15,23,42,0.8)]" />
                    <div className="h-[2px] bg-rose-500/90" />
                  </div>
                ) : null}

                {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => i).map(
                  (i) => (
                    <div
                      key={i}
                      className="absolute left-2 right-2 pointer-events-none"
                      style={{ top: i * ROW_HEIGHT_PX * 2 }}
                    >
                      <div className="h-px bg-slate-800/40" />
                    </div>
                  ),
                )}

                <div
                  className="absolute inset-0"
                  onPointerDown={(e) => {
                    if (!onCreateRange || drag) return;
                    const element = e.currentTarget;
                    const nextMin = pointerToMinutes(e.clientY, element);
                    element.setPointerCapture(e.pointerId);
                    setDraft({
                      dayIndex,
                      pointerId: e.pointerId,
                      startMin: nextMin,
                      currentMin: nextMin,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (!draft || draft.dayIndex !== dayIndex || draft.pointerId !== e.pointerId)
                      return;
                    const nextMin = pointerToMinutes(e.clientY, e.currentTarget);
                    setDraft((current) =>
                      current && current.dayIndex === dayIndex && current.pointerId === e.pointerId
                        ? { ...current, currentMin: nextMin }
                        : current,
                    );
                  }}
                  onPointerUp={(e) => {
                    if (!onCreateRange || !draft) return;
                    if (draft.dayIndex !== dayIndex || draft.pointerId !== e.pointerId) return;
                    const element = e.currentTarget;
                    if (element.hasPointerCapture(e.pointerId))
                      element.releasePointerCapture(e.pointerId);
                    const nextMin = pointerToMinutes(e.clientY, element);
                    const nextRange = rangeFromDraft(dayIndex, draft.startMin, nextMin);
                    setDraft(null);
                    onCreateRange(nextRange.startAtMs, nextRange.durationMs);
                  }}
                  onPointerCancel={(e) => {
                    const element = e.currentTarget;
                    if (element.hasPointerCapture(e.pointerId))
                      element.releasePointerCapture(e.pointerId);
                    setDraft(null);
                  }}
                />

                {draft && draft.dayIndex === dayIndex
                  ? (() => {
                      const nextRange = rangeFromDraft(dayIndex, draft.startMin, draft.currentMin);
                      return (
                        <div
                          className="absolute left-1 right-1 rounded-md border border-indigo-300/70 bg-indigo-500/20 pointer-events-none"
                          style={{
                            top: nextRange.topPx + 2,
                            height: Math.max(26, nextRange.heightPx),
                          }}
                        />
                      );
                    })()
                  : null}

                {drag && drag.previewDayIndex === dayIndex ? (
                  <div
                    className={`absolute z-30 rounded-md border border-white/40 bg-white/10 pointer-events-none ${
                      drag.mode === 'resize' ? 'border-dashed' : ''
                    }`}
                    style={{
                      top:
                        ((drag.previewStartMin - gridStartMin) / GRID_ROW_MINUTES) * ROW_HEIGHT_PX +
                        2,
                      left: '2px',
                      width: 'calc(100% - 4px)',
                      height: Math.max(
                        26,
                        (drag.previewDurationMin / GRID_ROW_MINUTES) * ROW_HEIGHT_PX,
                      ),
                    }}
                  />
                ) : null}

                {daySegments.map((segment) => {
                  const startMin = getMinutesSinceMidnight(segment.segmentStartAtMs);
                  const endMin = getMinutesSinceMidnight(
                    segment.segmentStartAtMs + segment.segmentDurationMs,
                  );
                  const clampedStart = Math.max(startMin, gridStartMin);
                  const clampedEnd = Math.min(endMin, gridEndMin);
                  const durationMin = clampedEnd - clampedStart;
                  if (durationMin <= 0) return null;

                  const topPx = ((clampedStart - gridStartMin) / GRID_ROW_MINUTES) * ROW_HEIGHT_PX;
                  const heightPx = (durationMin / GRID_ROW_MINUTES) * ROW_HEIGHT_PX;
                  const widthPct = 100 / segment.clusterSize;
                  const leftPct = segment.laneIdx * widthPct;
                  const bg = segment.accentColor ?? 'rgba(99,102,241,0.55)';
                  const isPlanned = segment.source === 'planned';
                  const isDragged =
                    drag?.segmentId === segment.segmentId &&
                    drag.occurrenceStartAtMs === segment.startAtMs;

                  return (
                    <div
                      key={segment.segmentId}
                      className={`absolute rounded-md px-2 overflow-hidden shadow-sm ${
                        isPlanned ? 'cursor-grab hover:brightness-105' : 'cursor-default'
                      }`}
                      style={{
                        top: topPx + 2,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        height: Math.max(26, heightPx),
                        backgroundColor: bg,
                        color: '#FFFFFF',
                        opacity: isDragged ? 0.35 : 1,
                        touchAction: isPlanned ? 'none' : undefined,
                      }}
                      role={isPlanned ? 'button' : undefined}
                      tabIndex={onEntryClick ? 0 : undefined}
                      onPointerDown={(e) => {
                        if (!isPlanned) return;
                        e.stopPropagation();
                        e.preventDefault();
                        const currentTarget = e.currentTarget;
                        const parent = currentTarget.parentElement;
                        const dayWidthPx =
                          parent?.getBoundingClientRect().width ??
                          currentTarget.getBoundingClientRect().width;
                        currentTarget.setPointerCapture(e.pointerId);
                        setDrag({
                          mode: 'move',
                          pointerId: e.pointerId,
                          segmentId: segment.segmentId,
                          occurrenceStartAtMs: segment.startAtMs,
                          originDayIndex: dayIndex,
                          dayWidthPx,
                          originClientX: e.clientX,
                          originClientY: e.clientY,
                          originStartMin: clampedStart,
                          originDurationMin: durationMin,
                          previewDayIndex: dayIndex,
                          previewStartMin: clampedStart,
                          previewDurationMin: durationMin,
                          didDrag: false,
                        });
                      }}
                      onPointerMove={(e) => {
                        if (
                          !drag ||
                          drag.pointerId !== e.pointerId ||
                          drag.segmentId !== segment.segmentId
                        ) {
                          return;
                        }
                        e.preventDefault();

                        if (drag.mode === 'move') {
                          const deltaX = e.clientX - drag.originClientX;
                          const deltaY = e.clientY - drag.originClientY;
                          const nextDayIndex = dayIndexFromDelta(
                            drag.originDayIndex,
                            deltaX,
                            drag.dayWidthPx,
                          );
                          const deltaMin = minutesFromDelta(deltaY);
                          const maxStartMin = Math.max(
                            gridStartMin,
                            gridEndMin - drag.originDurationMin,
                          );
                          const nextStartMin = Math.max(
                            gridStartMin,
                            Math.min(maxStartMin, drag.originStartMin + deltaMin),
                          );

                          setDrag((current) =>
                            current && current.pointerId === e.pointerId
                              ? {
                                  ...current,
                                  previewDayIndex: nextDayIndex,
                                  previewStartMin: nextStartMin,
                                  previewDurationMin: current.originDurationMin,
                                  didDrag:
                                    current.didDrag ||
                                    Math.abs(deltaX) >= DRAG_THRESHOLD_PX ||
                                    Math.abs(deltaY) >= DRAG_THRESHOLD_PX ||
                                    nextDayIndex !== current.originDayIndex ||
                                    nextStartMin !== current.originStartMin,
                                }
                              : current,
                          );
                          return;
                        }

                        const deltaMin = minutesFromDelta(e.clientY - drag.originClientY);
                        const maxDurationMin = Math.max(
                          GRID_ROW_MINUTES,
                          gridEndMin - drag.originStartMin,
                        );
                        const nextDurationMin = Math.max(
                          GRID_ROW_MINUTES,
                          Math.min(maxDurationMin, drag.originDurationMin + deltaMin),
                        );

                        setDrag((current) =>
                          current && current.pointerId === e.pointerId
                            ? {
                                ...current,
                                previewDayIndex: current.originDayIndex,
                                previewStartMin: current.originStartMin,
                                previewDurationMin: nextDurationMin,
                                didDrag:
                                  current.didDrag ||
                                  Math.abs(e.clientY - current.originClientY) >= DRAG_THRESHOLD_PX ||
                                  nextDurationMin !== current.originDurationMin,
                              }
                            : current,
                        );
                      }}
                      onPointerUp={async (e) => {
                        if (
                          !drag ||
                          drag.pointerId !== e.pointerId ||
                          drag.segmentId !== segment.segmentId
                        ) {
                          return;
                        }
                        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }
                        e.preventDefault();

                        let nextDayIndex = drag.previewDayIndex;
                        let nextStartMin = drag.previewStartMin;
                        let nextDurationMin = drag.previewDurationMin;

                        if (drag.mode === 'move') {
                          const deltaX = e.clientX - drag.originClientX;
                          const deltaY = e.clientY - drag.originClientY;
                          nextDayIndex = dayIndexFromDelta(
                            drag.originDayIndex,
                            deltaX,
                            drag.dayWidthPx,
                          );
                          const deltaMin = minutesFromDelta(deltaY);
                          const maxStartMin = Math.max(
                            gridStartMin,
                            gridEndMin - drag.originDurationMin,
                          );
                          nextStartMin = Math.max(
                            gridStartMin,
                            Math.min(maxStartMin, drag.originStartMin + deltaMin),
                          );
                          nextDurationMin = drag.originDurationMin;
                        } else {
                          const deltaMin = minutesFromDelta(e.clientY - drag.originClientY);
                          const maxDurationMin = Math.max(
                            GRID_ROW_MINUTES,
                            gridEndMin - drag.originStartMin,
                          );
                          nextDayIndex = drag.originDayIndex;
                          nextStartMin = drag.originStartMin;
                          nextDurationMin = Math.max(
                            GRID_ROW_MINUTES,
                            Math.min(maxDurationMin, drag.originDurationMin + deltaMin),
                          );
                        }

                        const gestureMoved =
                          drag.mode === 'move'
                            ? Math.abs(e.clientX - drag.originClientX) >= DRAG_THRESHOLD_PX ||
                              Math.abs(e.clientY - drag.originClientY) >= DRAG_THRESHOLD_PX
                            : Math.abs(e.clientY - drag.originClientY) >= DRAG_THRESHOLD_PX;

                        const changed =
                          drag.mode === 'move'
                            ? nextDayIndex !== drag.originDayIndex ||
                              nextStartMin !== drag.originStartMin
                            : nextDurationMin !== drag.originDurationMin;
                        const nextStartAtMs = toStartAtMs(nextDayIndex, nextStartMin);
                        const nextDurationMs = nextDurationMin * 60_000;
                        const completedDrag = {
                          ...drag,
                          previewDayIndex: nextDayIndex,
                          previewStartMin: nextStartMin,
                          previewDurationMin: nextDurationMin,
                          didDrag: drag.didDrag || gestureMoved,
                        };
                        setDrag(null);

                        if (!completedDrag.didDrag && !changed) return;
                        suppressClickEntryIdRef.current = segment.segmentId;
                        suppressClickUntilRef.current = Date.now() + 400;
                        if (!changed || !onPlannedEntryChange) return;
                        await onPlannedEntryChange(
                          segment,
                          completedDrag.mode === 'move'
                            ? { startAtMs: nextStartAtMs }
                            : { durationMs: nextDurationMs },
                        );
                      }}
                      onPointerCancel={(e) => {
                        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }
                        setDrag(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          suppressClickEntryIdRef.current === segment.segmentId ||
                          Date.now() < suppressClickUntilRef.current
                        ) {
                          suppressClickEntryIdRef.current = null;
                          return;
                        }
                        if (!onEntryClick) return;
                        onEntryClick(segment);
                      }}
                      onKeyDown={(e) => {
                        if (!onEntryClick) return;
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        onEntryClick(segment);
                      }}
                    >
                      <div className="text-[12px] font-semibold leading-tight truncate">
                        {segment.title}
                      </div>
                      <div className="text-[11px] opacity-90">
                        {formatCalendarTimeRange(
                          segment.segmentStartAtMs,
                          segment.segmentDurationMs,
                        )}
                      </div>
                      {isPlanned && !isCoarsePointer ? (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-black/10 hover:bg-black/20"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            suppressClickEntryIdRef.current = segment.segmentId;
                            suppressClickUntilRef.current = Date.now() + 400;
                            const entryElement = e.currentTarget
                              .parentElement as HTMLDivElement | null;
                            const parent = entryElement?.parentElement;
                            const dayWidthPx =
                              parent?.getBoundingClientRect().width ??
                              entryElement?.getBoundingClientRect().width ??
                              1;
                            entryElement?.setPointerCapture(e.pointerId);
                            setDrag({
                              mode: 'resize',
                              pointerId: e.pointerId,
                              segmentId: segment.segmentId,
                              occurrenceStartAtMs: segment.startAtMs,
                              originDayIndex: dayIndex,
                              dayWidthPx,
                              originClientX: e.clientX,
                              originClientY: e.clientY,
                              originStartMin: clampedStart,
                              originDurationMin: durationMin,
                              previewDayIndex: dayIndex,
                              previewStartMin: clampedStart,
                              previewDurationMin: durationMin,
                              didDrag: false,
                            });
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
