export type TopicSummaryCacheEntry = {
  calendarDay: string;
  sessionRevision: string;
  summary: string;
};

export function topicSummaryCacheKey(topicId: string) {
  return `topic-progress-summary:${topicId}`;
}

export function readTopicSummaryCache(topicId: string): TopicSummaryCacheEntry | null {
  try {
    const raw = localStorage.getItem(topicSummaryCacheKey(topicId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<TopicSummaryCacheEntry>;
    if (
      typeof p.calendarDay !== 'string' ||
      typeof p.sessionRevision !== 'string' ||
      typeof p.summary !== 'string'
    ) {
      return null;
    }
    return {
      calendarDay: p.calendarDay,
      sessionRevision: p.sessionRevision,
      summary: p.summary,
    };
  } catch {
    return null;
  }
}

export function writeTopicSummaryCache(topicId: string, entry: TopicSummaryCacheEntry) {
  try {
    localStorage.setItem(topicSummaryCacheKey(topicId), JSON.stringify(entry));
  } catch {
    /* ignore quota */
  }
}

export function clearTopicSummaryCache(topicId: string) {
  try {
    localStorage.removeItem(topicSummaryCacheKey(topicId));
  } catch {
    /* ignore */
  }
}

export function localCalendarDayKey() {
  return new Date().toLocaleDateString('en-CA');
}
