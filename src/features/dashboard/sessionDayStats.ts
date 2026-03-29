import type { StudySession } from '../../domain/models';

export type SessionDayStat = {
  key: string;
  dateMs: number;
  totalMs: number;
  weekdayShort: string;
  shortLabel: string;
  fullLabel: string;
};

const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const shortDateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const fullDateFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function startOfLocalDay(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, deltaDays: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export function localDayKey(ms: number) {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSessionDurationMs(session: StudySession) {
  if (typeof session.endedAtMs !== 'number') return 0;
  return Math.max(0, session.endedAtMs - session.startedAtMs);
}

export function aggregateSessionMsByDay(sessions: StudySession[]) {
  const totalsByDay = new Map<string, number>();
  for (const session of sessions) {
    const totalMs = getSessionDurationMs(session);
    if (totalMs <= 0) continue;
    const key = localDayKey(session.startedAtMs);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + totalMs);
  }
  return totalsByDay;
}

export function buildRecentSessionDayStats(input: {
  dayCount: number;
  totalsByDay: Map<string, number>;
  nowMs?: number;
}): SessionDayStat[] {
  const today = startOfLocalDay(input.nowMs ?? Date.now());
  const start = addDays(today, -(input.dayCount - 1));

  return Array.from({ length: input.dayCount }, (_, index) => {
    const date = addDays(start, index);
    const key = localDayKey(date.getTime());
    return {
      key,
      dateMs: date.getTime(),
      totalMs: input.totalsByDay.get(key) ?? 0,
      weekdayShort: weekdayFormatter.format(date).replace('.', ''),
      shortLabel: shortDateFormatter.format(date),
      fullLabel: fullDateFormatter.format(date),
    };
  });
}

export function getWeekdayMondayIndex(ms: number) {
  return (new Date(ms).getDay() + 6) % 7;
}
