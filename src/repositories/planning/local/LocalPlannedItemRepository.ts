import { db } from '../../../db/db';
import { newId } from '../../../lib/id';
import type { PlannedItem, PlannedItemType, WeeklyRecurrence } from '../../../domain/models';
import type { PlannedItemCreateInput, PlannedItemRepository, PlannedItemUpdateInput } from '../interfaces';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function validateCreateInput(input: PlannedItemCreateInput) {
  if (!Number.isFinite(input.startAtMs)) throw new Error('Startzeit fehlt oder ist ungültig');
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) throw new Error('Dauer muss > 0 sein');

  if (input.type === 'studySession') {
    if (!input.topicId) throw new Error('Geplante Session benötigt ein Topic');
  }

  if (input.type === 'event') {
    if (!input.title || !input.title.trim()) throw new Error('Event benötigt einen Titel');
  }
}

function normalizeRecurrence(recurrence: WeeklyRecurrence | undefined): WeeklyRecurrence | undefined {
  if (!recurrence) return undefined;
  if (recurrence.kind !== 'weekly') return undefined;
  if (!Number.isFinite(recurrence.intervalWeeks) || recurrence.intervalWeeks <= 0) {
    return undefined;
  }
  return {
    kind: 'weekly',
    intervalWeeks: Math.floor(recurrence.intervalWeeks),
    untilAtMs: recurrence.untilAtMs,
    occurrenceCount: recurrence.occurrenceCount,
  };
}

function getRecurrenceIntervalMs(recurrence: WeeklyRecurrence): number {
  return recurrence.intervalWeeks * ONE_WEEK_MS;
}

function getRecurrenceLastOccurrenceStartMs(item: PlannedItem): number | undefined {
  if (!item.recurrence) return item.startAtMs;
  const r = item.recurrence;

  const candidates: number[] = [];
  if (r.untilAtMs !== undefined && Number.isFinite(r.untilAtMs)) {
    candidates.push(r.untilAtMs);
  }
  if (r.occurrenceCount !== undefined && Number.isFinite(r.occurrenceCount) && r.occurrenceCount > 0) {
    const intervalMs = getRecurrenceIntervalMs(r);
    candidates.push(item.startAtMs + (r.occurrenceCount - 1) * intervalMs);
  }

  if (candidates.length === 0) return undefined; // open ended
  return Math.min(...candidates);
}

function computeFirstOccurrenceStartMsForRange(item: PlannedItem, rangeStartMs: number): number {
  if (!item.recurrence) return item.startAtMs;
  const r = item.recurrence;
  const intervalMs = getRecurrenceIntervalMs(r);

  if (rangeStartMs <= item.startAtMs) return item.startAtMs;
  const rawK = (rangeStartMs - item.startAtMs) / intervalMs;
  const k = Math.max(0, Math.ceil(rawK));
  return item.startAtMs + k * intervalMs;
}

function couldOverlapRange(item: PlannedItem, rangeStartMs: number, rangeEndMs: number): boolean {
  if (item.startAtMs >= rangeEndMs) return false;

  if (!item.recurrence) {
    const endAtMs = item.startAtMs + item.durationMs;
    return item.startAtMs < rangeEndMs && endAtMs > rangeStartMs;
  }

  const firstStartMs = computeFirstOccurrenceStartMsForRange(item, rangeStartMs);
  if (firstStartMs >= rangeEndMs) return false;

  const lastStartMs = getRecurrenceLastOccurrenceStartMs(item);
  if (lastStartMs !== undefined && firstStartMs > lastStartMs) return false;

  // If there is an occurrence that starts before rangeEnd, it will overlap visually as long
  // as its duration isn't entirely before rangeStart.
  const effectiveEnd = firstStartMs + item.durationMs;
  return effectiveEnd > rangeStartMs;
}

export class LocalPlannedItemRepository implements PlannedItemRepository {
  async get(id: string): Promise<PlannedItem | undefined> {
    return db.plannedItems.get(id);
  }

  async listPotentiallyOverlappingRange(rangeStartMs: number, rangeEndMs: number): Promise<PlannedItem[]> {
    // Fetch candidates by start time; recurrence expansion will refine on the UI side.
    const rows = await db.plannedItems.where('startAtMs').below(rangeEndMs).toArray();
    return rows.filter((item) => couldOverlapRange(item, rangeStartMs, rangeEndMs));
  }

  async create(input: PlannedItemCreateInput): Promise<PlannedItem> {
    validateCreateInput(input);

    const now = Date.now();
    const row: PlannedItem = {
      id: newId(),
      type: input.type,
      subjectId: input.subjectId,
      topicId: input.topicId,
      title: input.type === 'event' ? input.title?.trim() || undefined : undefined,
      startAtMs: input.startAtMs,
      durationMs: input.durationMs,
      recurrence: normalizeRecurrence(input.recurrence),
      createdAtMs: now,
      updatedAtMs: now,
    };

    await db.plannedItems.add(row);
    return row;
  }

  async update(id: string, patch: PlannedItemUpdateInput): Promise<PlannedItem> {
    const current = await db.plannedItems.get(id);
    if (!current) throw new Error('Geplantes Item nicht gefunden');

    const nextType: PlannedItemType = patch.type ?? current.type;
    const nextTitle = patch.title !== undefined ? patch.title : current.title;
    const nextSubjectId = patch.subjectId !== undefined ? patch.subjectId : current.subjectId;
    const nextTopicId = patch.topicId !== undefined ? patch.topicId : current.topicId;
    const hasRecurrenceKey = Object.prototype.hasOwnProperty.call(patch, 'recurrence');

    const next: PlannedItem = {
      ...current,
      ...patch,
      type: nextType,
      subjectId: nextSubjectId,
      topicId: nextTopicId,
      title: nextType === 'event' ? nextTitle?.trim() || undefined : undefined,
      recurrence: hasRecurrenceKey ? normalizeRecurrence(patch.recurrence) : current.recurrence,
      updatedAtMs: Date.now(),
    };

    // Validate required fields for the resulting type.
    validateCreateInput({
      type: next.type,
      startAtMs: next.startAtMs,
      durationMs: next.durationMs,
      recurrence: next.recurrence,
      subjectId: next.subjectId,
      topicId: next.topicId,
      title: next.title,
    });

    await db.plannedItems.put(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    await db.plannedItems.delete(id);
  }
}

