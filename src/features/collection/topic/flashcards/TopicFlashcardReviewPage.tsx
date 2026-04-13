import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NotFoundPage } from '../../../common/NotFoundPage';
import type { Flashcard } from '../../../../domain/models';
import { flashcardRepo } from '../../../../repositories';
import { useSubjectsStore } from '../../../../stores/subjectsStore';
import { useTopicsStore } from '../../../../stores/topicsStore';
import { FlashcardReviewSession } from './FlashcardReviewSession';

function buildReviewQueue(flashcards: Flashcard[], scope: 'due' | 'all') {
  const now = Date.now();
  return flashcards
    .filter((card) => card.state === 'active' && (scope === 'all' || card.dueAtMs <= now))
    .sort((a, b) => a.dueAtMs - b.dueAtMs || a.updatedAtMs - b.updatedAtMs);
}

export function TopicFlashcardReviewPage() {
  const { subjectId, topicId, scope } = useParams();
  const navigate = useNavigate();
  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  const reviewScope = scope === 'due' || scope === 'all' ? scope : null;

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    if (subjectId) void refreshBySubject(subjectId);
  }, [refreshBySubject, subjectId]);

  useEffect(() => {
    if (!topicId || !reviewScope) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await flashcardRepo.listByTopic(topicId);
        if (!cancelled) setFlashcards(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topicId, reviewScope]);

  const subject = useMemo(
    () => subjects.find((item) => item.id === subjectId),
    [subjectId, subjects],
  );
  const topic = useMemo(() => {
    if (!subjectId) return undefined;
    return (topicsBySubject[subjectId] ?? []).find((item) => item.id === topicId);
  }, [subjectId, topicId, topicsBySubject]);

  const queue = useMemo(() => {
    if (!reviewScope) return [];
    return buildReviewQueue(flashcards, reviewScope);
  }, [flashcards, reviewScope]);

  if (!subjectId || !topicId || !scope) return <NotFoundPage />;
  if (!reviewScope) return <NotFoundPage />;
  if (subjects.length > 0 && !subject) return <NotFoundPage />;
  if (!topic && (topicsBySubject[subjectId]?.length ?? 0) > 0) return <NotFoundPage />;

  const back = () => navigate(`/subjects/${subjectId}/topics/${topicId}/flashcards`);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-sm text-white/60">
        Lade Abfrage…
      </div>
    );
  }

  return <FlashcardReviewSession cards={queue} onBack={back} />;
}
