import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { PageHeader } from '../../../../components/PageHeader';
import { PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import type { Chapter, Flashcard, Requirement } from '../../../../domain/models';
import { flashcardRepo } from '../../../../repositories';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import {
  applyFlashcardReview,
  formatFlashcardDueLabel,
} from './flashcardSrs';

const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];

type FlashcardFilter = 'all' | 'due';

export function TopicFlashcardsView(props: {
  subjectId: string;
  topicId: string;
  subjectName?: string;
  topicName?: string;
  onBackToTopic: () => void;
}) {
  const refreshTopicCurriculum = useCurriculumStore((s) => s.refreshTopicCurriculum);
  const chapters = useCurriculumStore((s) => s.chaptersByTopic[props.topicId] ?? EMPTY_CHAPTERS);
  const requirements = useCurriculumStore(
    (s) => s.requirementsByTopic[props.topicId] ?? EMPTY_REQUIREMENTS,
  );
  const curriculumLoading = useCurriculumStore((s) => s.loadingByTopic[props.topicId] ?? false);
  const curriculumError = useCurriculumStore((s) => s.errorByTopic[props.topicId]);

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FlashcardFilter>('all');
  const [viewMode, setViewMode] = useState<'library' | 'review'>('library');
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editChapterId, setEditChapterId] = useState('');
  const [editRequirementId, setEditRequirementId] = useState('');

  useEffect(() => {
    const store = useCurriculumStore.getState();
    const alreadyLoaded = (store.chaptersByTopic[props.topicId]?.length ?? 0) > 0;
    const isLoading = store.loadingByTopic[props.topicId] ?? false;
    if (!alreadyLoaded && !isLoading) void refreshTopicCurriculum(props.topicId);
  }, [props.topicId, refreshTopicCurriculum]);

  const loadFlashcards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFlashcards(await flashcardRepo.listByTopic(props.topicId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Karteikarten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [props.topicId]);

  useEffect(() => {
    void loadFlashcards();
  }, [loadFlashcards]);

  const nowMs = Date.now();
  const dueCards = useMemo(
    () => flashcards.filter((card) => card.state === 'active' && card.dueAtMs <= nowMs),
    [flashcards, nowMs],
  );
  const visibleCards = useMemo(
    () =>
      flashcards.filter(
        (card) => card.state === 'active' && (filter === 'all' || card.dueAtMs <= nowMs),
      ),
    [filter, flashcards, nowMs],
  );

  const chapterById = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const requirementById = useMemo(
    () => new Map(requirements.map((requirement) => [requirement.id, requirement])),
    [requirements],
  );
  const requirementsByChapterId = useMemo(() => {
    const map = new Map<string, Requirement[]>();
    for (const requirement of requirements) {
      const list = map.get(requirement.chapterId) ?? [];
      list.push(requirement);
      map.set(requirement.chapterId, list);
    }
    return map;
  }, [requirements]);

  const sections = useMemo(
    () => buildFlashcardSections(visibleCards, chapters, chapterById, requirementById),
    [visibleCards, chapters, chapterById, requirementById],
  );

  const currentReviewCard = reviewQueue[reviewIndex];

  const startReview = useCallback(
    (scope: 'due' | 'all') => {
      const cards = flashcards
        .filter((card) => card.state === 'active' && (scope === 'all' || card.dueAtMs <= Date.now()))
        .sort((a, b) => a.dueAtMs - b.dueAtMs || a.updatedAtMs - b.updatedAtMs);
      if (cards.length === 0) return;
      setReviewQueue(cards);
      setReviewIndex(0);
      setRevealAnswer(false);
      setViewMode('review');
    },
    [flashcards],
  );

  const handleReview = useCallback(
    async (rating: 'known' | 'unknown') => {
      if (!currentReviewCard) return;
      setSavingId(currentReviewCard.id);
      const now = Date.now();
      try {
        const next = applyFlashcardReview(currentReviewCard, rating, now);
        const saved = await flashcardRepo.upsert({
          ...next,
          id: next.id,
          createdAtMs: next.createdAtMs,
          updatedAtMs: next.updatedAtMs,
        });
        setFlashcards((current) => current.map((card) => (card.id === saved.id ? saved : card)));
        setReviewQueue((current) => current.map((card) => (card.id === saved.id ? saved : card)));
        setReviewIndex((current) => current + 1);
        setRevealAnswer(false);
      } finally {
        setSavingId(null);
      }
    },
    [currentReviewCard],
  );

  const startEditing = useCallback((card: Flashcard) => {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditChapterId(card.chapterId ?? '');
    setEditRequirementId(card.requirementId ?? '');
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditFront('');
    setEditBack('');
    setEditChapterId('');
    setEditRequirementId('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const current = flashcards.find((card) => card.id === editingId);
    if (!current) return;
    setSavingId(current.id);
    try {
      const saved = await flashcardRepo.upsert({
        ...current,
        id: current.id,
        front: editFront,
        back: editBack,
        chapterId: editChapterId || undefined,
        requirementId: editRequirementId || undefined,
        createdAtMs: current.createdAtMs,
      });
      setFlashcards((cards) => cards.map((card) => (card.id === saved.id ? saved : card)));
      cancelEditing();
    } finally {
      setSavingId(null);
    }
  }, [cancelEditing, editBack, editChapterId, editFront, editRequirementId, editingId, flashcards]);

  const handleDelete = useCallback(async (card: Flashcard) => {
    if (!window.confirm(`Karteikarte wirklich löschen?\n\n${card.front}`)) return;
    setSavingId(card.id);
    try {
      await flashcardRepo.delete(card.id);
      setFlashcards((current) => current.filter((entry) => entry.id !== card.id));
      if (editingId === card.id) cancelEditing();
    } finally {
      setSavingId(null);
    }
  }, [cancelEditing, editingId]);

  const requirementOptions = editChapterId ? (requirementsByChapterId.get(editChapterId) ?? []) : [];

  return (
    <div className="pb-16">
      <ViewerIconButton ariaLabel="Zurück" onClick={props.onBackToTopic} className="fixed left-6 top-6">
        <IoChevronBack />
      </ViewerIconButton>
      <div className="px-6 pt-6">
        <PageHeader
          title={`${props.topicName ? `${props.topicName} · ` : ''}Karteikarten`}
          actions={
            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={() => setViewMode('library')}>Sammlung</SecondaryButton>
              <SecondaryButton onClick={() => startReview('due')} disabled={dueCards.length === 0}>
                Faellige Karten
              </SecondaryButton>
              <PrimaryButton onClick={() => startReview('all')} disabled={flashcards.length === 0}>
                Alle abfragen
              </PrimaryButton>
            </div>
          }
        />
      </div>

      {viewMode === 'review' ? (
        <section className="px-6 pt-6">
          {!currentReviewCard ? (
            <div className="mx-auto max-w-3xl rounded-4xl border border-white/8 bg-white/4 p-8">
              <div className="text-sm text-white/60">Review abgeschlossen</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {reviewQueue.length > 0 ? `${reviewQueue.length} Karten bearbeitet` : 'Keine Karten offen'}
              </div>
              <div className="mt-4 flex gap-3">
                <PrimaryButton onClick={() => setViewMode('library')}>Zur Sammlung</PrimaryButton>
                <SecondaryButton onClick={() => startReview('due')} disabled={dueCards.length === 0}>
                  Noch faellige wiederholen
                </SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-white/70">
                Karte {reviewIndex + 1} von {reviewQueue.length}
              </div>
              <div className="rounded-4xl border border-white/8 bg-white/4 p-8">
                <div className="text-xs uppercase tracking-wide text-white/45">Vorderseite</div>
                <div className="mt-3 whitespace-pre-wrap text-2xl font-semibold text-white">
                  {currentReviewCard.front}
                </div>
                <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {chapterById.get(currentReviewCard.chapterId ?? '')?.name ?? 'Ohne Kapitel'}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {requirementById.get(currentReviewCard.requirementId ?? '')?.name ?? 'Ohne Requirement'}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {formatFlashcardDueLabel(currentReviewCard.dueAtMs, nowMs)}
                  </span>
                </div>
                {revealAnswer ? (
                  <div className="mt-8 rounded-3xl border border-emerald-400/15 bg-emerald-500/8 p-5">
                    <div className="text-xs uppercase tracking-wide text-emerald-100/70">Rueckseite</div>
                    <div className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-white">
                      {currentReviewCard.back}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {!revealAnswer ? (
                  <PrimaryButton onClick={() => setRevealAnswer(true)}>Antwort aufdecken</PrimaryButton>
                ) : (
                  <>
                    <SecondaryButton
                      onClick={() => void handleReview('unknown')}
                      disabled={savingId === currentReviewCard.id}
                    >
                      Nicht gewusst
                    </SecondaryButton>
                    <PrimaryButton
                      onClick={() => void handleReview('known')}
                      disabled={savingId === currentReviewCard.id}
                    >
                      Gewusst
                    </PrimaryButton>
                  </>
                )}
                <SecondaryButton onClick={() => setViewMode('library')}>Review beenden</SecondaryButton>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-6 px-6 pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <FlashcardStat label="Karten gesamt" value={flashcards.length} />
            <FlashcardStat label="Faellig" value={dueCards.length} />
            <FlashcardStat label="Kapitel mit Karten" value={new Set(flashcards.map((card) => card.chapterId).filter(Boolean)).size} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-full border px-4 py-2 text-sm ${
                filter === 'all'
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => setFilter('due')}
              className={`rounded-full border px-4 py-2 text-sm ${
                filter === 'due'
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Faellig
            </button>
          </div>

          {curriculumError ? (
            <div className="rounded-3xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              {curriculumError}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-3xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {loading || curriculumLoading ? (
            <div className="rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
              Karteikarten werden geladen…
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
              Fuer dieses Thema gibt es noch keine gespeicherten Karteikarten.
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.key} className="rounded-4xl border border-white/8 bg-white/4 p-5">
                <div className="text-xs uppercase tracking-wide text-white/45">{section.chapterLabel}</div>
                <div className="mt-2 text-xl font-semibold text-white">{section.requirementLabel}</div>
                <div className="mt-4 space-y-3">
                  {section.cards.map((card) => {
                    const isEditing = editingId === card.id;
                    return (
                      <div key={card.id} className="rounded-3xl border border-white/8 bg-white/5 p-4">
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              value={editFront}
                              onChange={(event) => setEditFront(event.currentTarget.value)}
                              rows={3}
                              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                              placeholder="Vorderseite"
                            />
                            <textarea
                              value={editBack}
                              onChange={(event) => setEditBack(event.currentTarget.value)}
                              rows={4}
                              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                              placeholder="Rueckseite"
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <select
                                value={editChapterId}
                                onChange={(event) => {
                                  const nextChapterId = event.currentTarget.value;
                                  setEditChapterId(nextChapterId);
                                  if (
                                    editRequirementId &&
                                    !(
                                      requirementsByChapterId
                                        .get(nextChapterId)
                                        ?.some((requirement) => requirement.id === editRequirementId)
                                    )
                                  ) {
                                    setEditRequirementId('');
                                  }
                                }}
                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                              >
                                <option value="">Ohne Kapitel</option>
                                {chapters.map((chapter) => (
                                  <option key={chapter.id} value={chapter.id}>
                                    {chapter.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editRequirementId}
                                onChange={(event) => setEditRequirementId(event.currentTarget.value)}
                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                              >
                                <option value="">Ohne Requirement</option>
                                {requirementOptions.map((requirement) => (
                                  <option key={requirement.id} value={requirement.id}>
                                    {requirement.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <PrimaryButton
                                onClick={() => void handleSaveEdit()}
                                disabled={!editFront.trim() || !editBack.trim() || savingId === card.id}
                              >
                                Speichern
                              </PrimaryButton>
                              <SecondaryButton onClick={cancelEditing}>Abbrechen</SecondaryButton>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-3">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-white/45">
                                  Vorderseite
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-white">{card.front}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-white/45">
                                  Rueckseite
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-sm text-white/75">
                                  {card.back}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs text-white/60">
                                <span className="rounded-full border border-white/10 px-2 py-1">
                                  {formatFlashcardDueLabel(card.dueAtMs, nowMs)}
                                </span>
                                <span className="rounded-full border border-white/10 px-2 py-1">
                                  {card.source === 'ai_requirement' ? 'KI-generiert' : 'Manuell'}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <SecondaryButton onClick={() => startEditing(card)}>Bearbeiten</SecondaryButton>
                              <SecondaryButton
                                onClick={() => void handleDelete(card)}
                                disabled={savingId === card.id}
                              >
                                Loeschen
                              </SecondaryButton>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function FlashcardStat(props: { label: string; value: number }) {
  return (
    <div className="rounded-4xl border border-white/8 bg-white/4 p-5">
      <div className="text-sm text-white/55">{props.label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{props.value}</div>
    </div>
  );
}

function buildFlashcardSections(
  flashcards: Flashcard[],
  chapters: Chapter[],
  chapterById: Map<string, Chapter>,
  requirementById: Map<string, Requirement>,
) {
  const chapterOrder = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const sections = new Map<
    string,
    { key: string; chapterLabel: string; requirementLabel: string; sortKey: [number, string, string]; cards: Flashcard[] }
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
      sortKey: [chapter ? (chapterOrder.get(chapter.id) ?? 9999) : 10000, chapterLabel, requirementLabel],
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
