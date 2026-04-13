import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { PageHeader } from '../../../../components/PageHeader';
import { Modal } from '../../../../components/Modal';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import type { Chapter, Flashcard, Requirement } from '../../../../domain/models';
import { flashcardRepo } from '../../../../repositories';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import { createInitialFlashcardSchedule, formatFlashcardDueLabel } from './flashcardSrs';
import { buildFlashcardSections, FlashcardStat } from './flashcardSections';

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
  const navigate = useNavigate();
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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editChapterId, setEditChapterId] = useState('');
  const [editRequirementId, setEditRequirementId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newChapterId, setNewChapterId] = useState('');
  const [newRequirementId, setNewRequirementId] = useState('');

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

  const resetCreate = useCallback(() => {
    setNewFront('');
    setNewBack('');
    setNewChapterId('');
    setNewRequirementId('');
  }, []);

  const handleCreateSave = useCallback(async () => {
    if (!newFront.trim() || !newBack.trim()) return;
    setCreateSaving(true);
    try {
      const now = Date.now();
      await flashcardRepo.upsert({
        subjectId: props.subjectId,
        topicId: props.topicId,
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
    props.subjectId,
    props.topicId,
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
  const newRequirementOptions = newChapterId ? (requirementsByChapterId.get(newChapterId) ?? []) : [];

  const reviewBase = `/subjects/${props.subjectId}/topics/${props.topicId}/flashcards/review`;

  return (
    <div className="pb-16">
      <ViewerIconButton ariaLabel="Zurück" onClick={props.onBackToTopic} className="fixed left-6 top-6">
        <IoChevronBack />
      </ViewerIconButton>
      <div className="px-6 pt-6">
        <PageHeader
          title={`${props.topicName ? `${props.topicName} · ` : ''}Karteikarten`}
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
          <FlashcardStat
            label="Kapitel mit Karten"
            value={new Set(flashcards.map((card) => card.chapterId).filter(Boolean)).size}
          />
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
              disabled={createSaving || !newFront.trim() || !newBack.trim()}
            >
              {createSaving ? 'Speichern…' : 'Hinzufuegen'}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-300">
          <div className="text-lg font-semibold text-white">Neue Karteikarte</div>
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
                    requirementsByChapterId
                      .get(nextChapterId)
                      ?.some((requirement) => requirement.id === newRequirementId)
                  )
                ) {
                  setNewRequirementId('');
                }
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
            >
              <option value="">Ohne Kapitel</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
            <select
              value={newRequirementId}
              onChange={(event) => setNewRequirementId(event.currentTarget.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
            >
              <option value="">Ohne Requirement</option>
              {newRequirementOptions.map((requirement) => (
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
