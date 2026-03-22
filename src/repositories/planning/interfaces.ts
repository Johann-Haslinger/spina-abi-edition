import type { Id, PlannedItem, PlannedItemType, WeeklyRecurrence } from '../../domain/models';

export type PlannedItemCreateInput = {
  type: PlannedItemType;
  startAtMs: number;
  durationMs: number;
  recurrence?: WeeklyRecurrence;

  // type === 'studySession'
  subjectId?: Id;
  topicId?: Id;

  // type === 'event'
  title?: string;
};

export type PlannedItemUpdateInput = Partial<{
  type: PlannedItemType;
  startAtMs: number;
  durationMs: number;
  recurrence?: WeeklyRecurrence;

  subjectId?: Id;
  topicId?: Id;
  title?: string;
}>;

export interface PlannedItemRepository {
  get(id: string): Promise<PlannedItem | undefined>;
  listPotentiallyOverlappingRange(rangeStartMs: number, rangeEndMs: number): Promise<PlannedItem[]>;
  create(input: PlannedItemCreateInput): Promise<PlannedItem>;
  update(id: string, patch: PlannedItemUpdateInput): Promise<PlannedItem>;
  delete(id: string): Promise<void>;
}

