import type {
  Id,
  PlannedItem,
  PlannedItemType,
  StudySession,
  WeeklyRecurrence,
} from '../../../domain/models';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

export type CalendarEntry = {
  id: Id;
  source: 'planned' | 'past';
  type: PlannedItemType | 'studySession';
  title: string;
  accentColor?: string;
  subjectId?: Id;
  topicId?: Id;
  startAtMs: number;
  durationMs: number;
};

function formatAmPmHour(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
  })
    .format(new Date(ms))
    .replace(/\s/g, '')
    .toLowerCase();
}

function formatAmPmHourMinute(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(ms))
    .replace(/\s/g, '')
    .toLowerCase();
}

export function formatCalendarTimeRange(startAtMs: number, durationMs: number): string {
  const endAtMs = startAtMs + Math.max(0, durationMs);
  const start = new Date(startAtMs);
  const end = new Date(endAtMs);

  const startMinutes = start.getMinutes();
  const endMinutes = end.getMinutes();
  const startHourOnly = startMinutes === 0;
  const endHourOnly = endMinutes === 0;

  const startLabel = startHourOnly ? formatAmPmHour(startAtMs) : formatAmPmHourMinute(startAtMs);
  const endLabel = endHourOnly ? formatAmPmHour(endAtMs) : formatAmPmHourMinute(endAtMs);

  const startMeridiem = startLabel.endsWith('am') ? 'am' : 'pm';
  const endMeridiem = endLabel.endsWith('am') ? 'am' : 'pm';

  if (startMeridiem === endMeridiem) {
    const compactStart = startLabel.slice(0, -2);
    return `${compactStart}-${endLabel}`;
  }

  return `${startLabel}-${endLabel}`;
}

export function startOfWeekMs(dateMs: number): number {
  const d = new Date(dateMs);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDaysMs(dateMs: number, days: number): number {
  const d = new Date(dateMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function startOfDayMs(dateMs: number): number {
  const d = new Date(dateMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatWeekRange(weekStartMs: number): string {
  const start = new Date(weekStartMs);
  const end = new Date(addDaysMs(weekStartMs, 6));
  const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

export function getISOWeekNumber(dateMs: number): number {
  const d = new Date(dateMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week1Day = (week1.getDay() + 6) % 7;
  week1.setDate(week1.getDate() - week1Day + 3);
  const diffDays = Math.round((d.getTime() - week1.getTime()) / ONE_DAY_MS);
  return 1 + Math.floor(diffDays / 7);
}

function getWeeklyIntervalMs(recurrence: WeeklyRecurrence): number {
  return recurrence.intervalWeeks * ONE_WEEK_MS;
}

function getRecurrenceLastOccurrenceStartMs(item: PlannedItem): number | undefined {
  if (!item.recurrence) return item.startAtMs;
  const r = item.recurrence;

  const candidates: number[] = [];
  if (r.untilAtMs !== undefined && Number.isFinite(r.untilAtMs)) candidates.push(r.untilAtMs);
  if (
    r.occurrenceCount !== undefined &&
    Number.isFinite(r.occurrenceCount) &&
    r.occurrenceCount > 0
  ) {
    candidates.push(item.startAtMs + (r.occurrenceCount - 1) * getWeeklyIntervalMs(r));
  }
  if (candidates.length === 0) return undefined; // open ended
  return Math.min(...candidates);
}

export function expandPlannedItemOccurrences(
  item: PlannedItem,
  rangeStartMs: number,
  rangeEndMs: number,
): Array<{ startAtMs: number; durationMs: number }> {
  const durationMs = item.durationMs;
  const out: Array<{ startAtMs: number; durationMs: number }> = [];

  if (!item.recurrence) {
    if (item.startAtMs < rangeEndMs && item.startAtMs + durationMs > rangeStartMs) {
      out.push({ startAtMs: item.startAtMs, durationMs });
    }
    return out;
  }

  const r = item.recurrence;
  const intervalMs = getWeeklyIntervalMs(r);

  const lastStartMs = getRecurrenceLastOccurrenceStartMs(item);

  const minK = Math.floor((rangeStartMs - item.startAtMs) / intervalMs) - 1;
  const maxK = Math.ceil((rangeEndMs - item.startAtMs) / intervalMs) + 1;

  const startK = Math.max(0, minK);
  const endK =
    lastStartMs !== undefined
      ? Math.floor((lastStartMs - item.startAtMs) / intervalMs)
      : Math.max(startK, maxK);

  const upperK = Math.max(startK, endK, maxK);

  for (let k = startK; k <= upperK; k++) {
    const occStart = item.startAtMs + k * intervalMs;

    if (occStart >= rangeEndMs) break;
    if (lastStartMs !== undefined && occStart > lastStartMs) break;

    const occEnd = occStart + durationMs;
    if (occStart < rangeEndMs && occEnd > rangeStartMs) {
      out.push({ startAtMs: occStart, durationMs });
    }
  }

  return out;
}

export function toCalendarEntriesFromStudySession(
  session: StudySession,
  topicTitle: string,
): CalendarEntry {
  const durationMs = session.endedAtMs
    ? session.endedAtMs - session.startedAtMs
    : (session.plannedDurationMs ?? 0);
  return {
    id: session.id,
    source: 'past',
    type: 'studySession',
    title: topicTitle,
    subjectId: session.subjectId,
    topicId: session.topicId,
    startAtMs: session.startedAtMs,
    durationMs: Math.max(0, durationMs),
  };
}
