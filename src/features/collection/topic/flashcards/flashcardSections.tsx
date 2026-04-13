import type { Chapter, Flashcard, Requirement } from '../../../../domain/models';

export function FlashcardStat(props: { label: string; value: number }) {
  return (
    <div className="rounded-4xl border border-white/8 bg-white/4 p-5">
      <div className="text-sm text-white/55">{props.label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{props.value}</div>
    </div>
  );
}

export function buildFlashcardSections(
  flashcards: Flashcard[],
  chapters: Chapter[],
  chapterById: Map<string, Chapter>,
  requirementById: Map<string, Requirement>,
) {
  const chapterOrder = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const sections = new Map<
    string,
    {
      key: string;
      chapterLabel: string;
      requirementLabel: string;
      sortKey: [number, string, string];
      cards: Flashcard[];
    }
  >();

  for (const card of flashcards) {
    const chapter = card.chapterId ? chapterById.get(card.chapterId) : undefined;
    const requirement = card.requirementId ? requirementById.get(card.requirementId) : undefined;
    const chapterLabel = chapter?.name ?? 'Ohne Kapitel';
    const requirementLabel = requirement?.name ?? 'Ohne Requirement';
    const key = `${chapter?.id ?? 'none'}:${requirement?.id ?? 'none'}`;
    const current = sections.get(key) ?? {
      key,
      chapterLabel,
      requirementLabel,
      sortKey: [
        chapter ? (chapterOrder.get(chapter.id) ?? 9999) : 10000,
        chapterLabel,
        requirementLabel,
      ],
      cards: [],
    };
    current.cards.push(card);
    sections.set(key, current);
  }

  return Array.from(sections.values())
    .map((section) => ({
      ...section,
      cards: section.cards.sort((a, b) => a.dueAtMs - b.dueAtMs || b.updatedAtMs - a.updatedAtMs),
    }))
    .sort((a, b) => {
      if (a.sortKey[0] !== b.sortKey[0]) return a.sortKey[0] - b.sortKey[0];
      if (a.sortKey[1] !== b.sortKey[1]) return a.sortKey[1].localeCompare(b.sortKey[1]);
      return a.sortKey[2].localeCompare(b.sortKey[2]);
    });
}
