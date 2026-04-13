import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NotFoundPage } from '../../common/NotFoundPage';
import type { Flashcard } from '../../../domain/models';
import { flashcardRepo } from '../../../repositories';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { FlashcardReviewSession } from '../topic/flashcards/FlashcardReviewSession';

function buildReviewQueue(flashcards: Flashcard[], scope: 'due' | 'all') {
  const now = Date.now();
  return flashcards
    .filter((card) => card.state === 'active' && (scope === 'all' || card.dueAtMs <= now))
    .sort((a, b) => a.dueAtMs - b.dueAtMs || a.updatedAtMs - b.updatedAtMs);
}

export function SubjectFlashcardReviewPage() {
  const { subjectId, scope } = useParams();
  const navigate = useNavigate();
  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  const reviewScope = scope === 'due' || scope === 'all' ? scope : null;

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    if (!subjectId || !reviewScope) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await flashcardRepo.listBySubject(subjectId);
        if (!cancelled) setFlashcards(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, reviewScope]);

  const subject = useMemo(
    () => subjects.find((item) => item.id === subjectId),
    [subjectId, subjects],
  );

  const queue = useMemo(() => {
    if (!reviewScope) return [];
    return buildReviewQueue(flashcards, reviewScope);
  }, [flashcards, reviewScope]);

  if (!subjectId || !scope) return <NotFoundPage />;
  if (!reviewScope) return <NotFoundPage />;
  if (subjects.length > 0 && !subject) return <NotFoundPage />;

  const back = () => navigate(`/subjects/${subjectId}/flashcards`);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-sm text-white/60">
        Lade Abfrage…
      </div>
    );
  }

  return <FlashcardReviewSession cards={queue} onBack={back} />;
}
