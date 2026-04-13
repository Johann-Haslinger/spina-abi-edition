import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { PageHeader } from '../../../components/PageHeader';
import { ViewerIconButton } from '../../../components/ViewerIconButton';
import type { Chapter, Flashcard, Requirement } from '../../../domain/models';
import { flashcardRepo } from '../../../repositories';
import { useCurriculumStore } from '../../../stores/curriculumStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { buildFlashcardSections, FlashcardStat } from '../topic/flashcards/flashcardSections';
import { createInitialFlashcardSchedule, formatFlashcardDueLabel } from '../topic/flashcards/flashcardSrs';

const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];

type FlashcardFilter = 'all' | 'due';

export function SubjectFlashcardsView(props: {
  subjectId: string;
  subjectName?: string;
  onBackToSubject: () => void;
}) {
  const navigate = useNavigate();
  const topics = useTopicsStore((s) => s.topicsBySubject[props.subjectId] ?? []);
  const topicsLoading = useTopicsStore((s) => s.loadingBySubject[props.subjectId] ?? false);
  const refreshTopicCurriculum = useCurriculumStore((s) => s.refreshTopicCurriculum);
  const chaptersByTopic = useCurriculumStore((s) => s.chaptersByTopic);
  const requirementsByTopic = useCurriculumStore((s) => s.requirementsByTopic);
  const loadingByTopic = useCurriculumStore((s) => s.loadingByTopic);
  const errorByTopic = useCurriculumStore((s) => s.errorByTopic);

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FlashcardFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editChapterId, setEditChapterId] = useState('');
  const [editRequirementId, setEditRequirementId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [newTopicId, setNewTopicId] = useState('');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newChapterId, setNewChapterId] = useState('');
  const [newRequirementId, setNewRequirementId] = useState('');

  useEffect(() => {
    const topicIds = new Set<string>();
    for (const topic of topics) topicIds.add(topic.id);
    for (const card of flashcards) topicIds.add(card.topicId);
    for (const topicId of topicIds) {
      const store = useCurriculumStore.getState();
      const alreadyLoaded = (store.chaptersByTopic[topicId]?.length ?? 0) > 0;
      const isLoading = store.loadingByTopic[topicId] ?? false;
      if (!alreadyLoaded && !isLoading) void refreshTopicCurriculum(topicId);
    }
  }, [topics, flashcards, refreshTopicCurriculum]);

  useEffect(() => {
    if (!createOpen || !newTopicId) return;
    const store = useCurriculumStore.getState();
    const alreadyLoaded = (store.chaptersByTopic[newTopicId]?.length ?? 0) > 0;
    const isLoading = store.loadingByTopic[newTopicId] ?? false;
    if (!alreadyLoaded && !isLoading) void refreshTopicCurriculum(newTopicId);
  }, [createOpen, newTopicId, refreshTopicCurriculum]);

  const loadFlashcards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFlashcards(await flashcardRepo.listBySubject(props.subjectId));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Karteikarten konnten nicht geladen werden',
      );
    } finally {
      setLoading(false);
    }
  }, [props.subjectId]);

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

  const curriculumLoading = useMemo(
    () => topics.some((t) => loadingByTopic[t.id] ?? false),
    [topics, loadingByTopic],
  );

  const curriculumError = useMemo(() => {
    for (const t of topics) {
      const err = errorByTopic[t.id];
      if (err) return err;
    }
    return undefined;
  }, [topics, errorByTopic]);

  const topicBlocks = useMemo(() => {
    const blocks: {
      topicId: string;
      topicLabel: string;
      sections: ReturnType<typeof buildFlashcardSections>;
    }[] = [];

    const pushBlock = (topicId: string, topicLabel: string, cards: Flashcard[]) => {
      if (cards.length === 0) return;
      const chapters = chaptersByTopic[topicId] ?? EMPTY_CHAPTERS;
      const requirements = requirementsByTopic[topicId] ?? EMPTY_REQUIREMENTS;
      const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
      const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
      blocks.push({
        topicId,
        topicLabel,
        sections: buildFlashcardSections(cards, chapters, chapterById, requirementById),
      });
    };

    for (const topic of topics) {
      const topicCards = visibleCards.filter((c) => c.topicId === topic.id);
      pushBlock(topic.id, topic.name, topicCards);
    }

    if (!topicsLoading) {
      const knownTopicIds = new Set(topics.map((t) => t.id));
      const orphanTopicIds = [
        ...new Set(visibleCards.filter((c) => !knownTopicIds.has(c.topicId)).map((c) => c.topicId)),
      ];
      for (const tid of orphanTopicIds) {
        const topicCards = visibleCards.filter((c) => c.topicId === tid);
        pushBlock(tid, 'Weiteres Thema', topicCards);
      }
    }

    return blocks;
  }, [visibleCards, topics, topicsLoading, chaptersByTopic, requirementsByTopic]);

  const topicsWithCardCount = useMemo(() => {
    return new Set(flashcards.map((c) => c.topicId)).size;
  }, [flashcards]);

  const editingTopicId =
    editingId ? flashcards.find((c) => c.id === editingId)?.topicId : undefined;
  const editChapters = editingTopicId ? (chaptersByTopic[editingTopicId] ?? EMPTY_CHAPTERS) : EMPTY_CHAPTERS;
  const editRequirements = editingTopicId
    ? (requirementsByTopic[editingTopicId] ?? EMPTY_REQUIREMENTS)
    : EMPTY_REQUIREMENTS;
  const editRequirementsByChapterId = useMemo(() => {
    const map = new Map<string, Requirement[]>();
    for (const requirement of editRequirements) {
      const list = map.get(requirement.chapterId) ?? [];
      list.push(requirement);
      map.set(requirement.chapterId, list);
    }
    return map;
  }, [editRequirements]);

  const newChapters = newTopicId ? (chaptersByTopic[newTopicId] ?? EMPTY_CHAPTERS) : EMPTY_CHAPTERS;
  const newRequirements = newTopicId
    ? (requirementsByTopic[newTopicId] ?? EMPTY_REQUIREMENTS)
    : EMPTY_REQUIREMENTS;
  const newRequirementsByChapterId = useMemo(() => {
    const map = new Map<string, Requirement[]>();
    for (const requirement of newRequirements) {
      const list = map.get(requirement.chapterId) ?? [];
      list.push(requirement);
      map.set(requirement.chapterId, list);
    }
    return map;
  }, [newRequirements]);

  const resetCreate = useCallback(() => {
    setNewTopicId('');
    setNewFront('');
    setNewBack('');
    setNewChapterId('');
    setNewRequirementId('');
  }, []);

  const handleCreateSave = useCallback(async () => {
    if (!newTopicId || !newFront.trim() || !newBack.trim()) return;
    setCreateSaving(true);
    try {
      const now = Date.now();
      await flashcardRepo.upsert({
        subjectId: props.subjectId,
        topicId: newTopicId,
        front: newFront.trim(),
        back: newBack.trim(),
        chapterId: newChapterId || undefined,
        requirementId: newRequirementId || undefined,
        source: 'manual',
        state: 'active',
        ...createInitialFlashcardSchedule(now),
        createdAtMs: now,
      });
      await loadFlashcards();
      setCreateOpen(false);
      resetCreate();
    } finally {
      setCreateSaving(false);
    }
  }, [
    loadFlashcards,
    newBack,
    newChapterId,
    newFront,
    newRequirementId,
    newTopicId,
    props.subjectId,
    resetCreate,
  ]);

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

  const handleDelete = useCallback(
    async (card: Flashcard) => {
      if (!window.confirm(`Karteikarte wirklich löschen?\n\n${card.front}`)) return;
      setSavingId(card.id);
      try {
        await flashcardRepo.delete(card.id);
        setFlashcards((current) => current.filter((entry) => entry.id !== card.id));
        if (editingId === card.id) cancelEditing();
      } finally {
        setSavingId(null);
      }
    },
    [cancelEditing, editingId],
  );

  const editRequirementOptions = editChapterId
    ? (editRequirementsByChapterId.get(editChapterId) ?? [])
    : [];
  const createRequirementOptions = newChapterId
    ? (newRequirementsByChapterId.get(newChapterId) ?? [])
    : [];

  const reviewBase = `/subjects/${props.subjectId}/flashcards/review`;

  return (
    <div className="pb-16">
      <ViewerIconButton
        ariaLabel="Zurück"
        onClick={props.onBackToSubject}
        className="fixed left-6 top-6"
      >
        <IoChevronBack />
      </ViewerIconButton>
      <div className="px-6 pt-6">
        <PageHeader
          title={`${props.subjectName ? `${props.subjectName} · ` : ''}Karteikarten`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <GhostButton
                aria-label="Neue Karteikarte"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 p-0 text-white hover:bg-white/10"
              >
                <Plus className="h-5 w-5" strokeWidth={2} />
              </GhostButton>
              <SecondaryButton
                onClick={() => navigate(`${reviewBase}/due`)}
                disabled={dueCards.length === 0}
              >
                Faellige Karten
              </SecondaryButton>
              <PrimaryButton
                onClick={() => navigate(`${reviewBase}/all`)}
                disabled={flashcards.length === 0}
              >
                Alle abfragen
              </PrimaryButton>
            </div>
          }
        />
      </div>

      <section className="space-y-6 px-6 pt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <FlashcardStat label="Karten gesamt" value={flashcards.length} />
          <FlashcardStat label="Faellig" value={dueCards.length} />
          <FlashcardStat label="Themen mit Karten" value={topicsWithCardCount} />
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
        {loading || curriculumLoading || topicsLoading ? (
          <div className="rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
            Karteikarten werden geladen…
          </div>
        ) : topicBlocks.length === 0 ? (
          <div className="rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
            Fuer dieses Fach gibt es noch keine gespeicherten Karteikarten.
          </div>
        ) : (
          topicBlocks.map((block) => (
            <div key={block.topicId} className="space-y-4">
              <div className="text-lg font-semibold text-white">{block.topicLabel}</div>
              {block.sections.map((section) => (
                <section
                  key={`${block.topicId}:${section.key}`}
                  className="rounded-4xl border border-white/8 bg-white/4 p-5"
                >
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    {section.chapterLabel}
                  </div>
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
                                        editRequirementsByChapterId
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
                                  {editChapters.map((chapter) => (
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
                                  {editRequirementOptions.map((requirement) => (
                                    <option key={requirement.id} value={requirement.id}>
                                      {requirement.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <PrimaryButton
                                  onClick={() => void handleSaveEdit()}
                                  disabled={
                                    !editFront.trim() || !editBack.trim() || savingId === card.id
                                  }
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
                                <SecondaryButton onClick={() => startEditing(card)}>
                                  Bearbeiten
                                </SecondaryButton>
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
              ))}
            </div>
          ))
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => {
          if (createSaving) return;
          setCreateOpen(false);
          resetCreate();
        }}
        footer={
          <>
            <SecondaryButton
              onClick={() => {
                if (createSaving) return;
                setCreateOpen(false);
                resetCreate();
              }}
              disabled={createSaving}
            >
              Abbrechen
            </SecondaryButton>
            <PrimaryButton
              onClick={() => void handleCreateSave()}
              disabled={createSaving || !newTopicId || !newFront.trim() || !newBack.trim()}
            >
              {createSaving ? 'Speichern…' : 'Hinzufuegen'}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <div className="text-lg font-semibold text-white">Neue Karteikarte</div>
          <div className="space-y-1">
            <div className="text-white/80">Thema</div>
            <select
              value={newTopicId}
              onChange={(e) => {
                setNewTopicId(e.target.value);
                setNewChapterId('');
                setNewRequirementId('');
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
            >
              <option value="">Thema waehlen…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            rows={3}
            placeholder="Vorderseite"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/40"
          />
          <textarea
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            rows={4}
            placeholder="Rueckseite"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/40"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={newChapterId}
              onChange={(event) => {
                const nextChapterId = event.currentTarget.value;
                setNewChapterId(nextChapterId);
                if (
                  newRequirementId &&
                  !(
                    newRequirementsByChapterId
                      .get(nextChapterId)
                      ?.some((requirement) => requirement.id === newRequirementId)
                  )
                ) {
                  setNewRequirementId('');
                }
              }}
              disabled={!newTopicId}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none disabled:opacity-50"
            >
              <option value="">Ohne Kapitel</option>
              {newChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
            <select
              value={newRequirementId}
              onChange={(event) => setNewRequirementId(event.currentTarget.value)}
              disabled={!newTopicId}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none disabled:opacity-50"
            >
              <option value="">Ohne Requirement</option>
              {createRequirementOptions.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {requirement.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
