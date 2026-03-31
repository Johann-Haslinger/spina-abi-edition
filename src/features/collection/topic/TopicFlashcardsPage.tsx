import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NotFoundPage } from '../../common/NotFoundPage';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { TopicFlashcardsView } from './flashcards/TopicFlashcardsView';

export function TopicFlashcardsPage() {
  const { subjectId, topicId } = useParams();
  const navigate = useNavigate();
  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { topicsBySubject, refreshBySubject } = useTopicsStore();

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  useEffect(() => {
    if (subjectId) void refreshBySubject(subjectId);
  }, [refreshBySubject, subjectId]);

  const subject = useMemo(
    () => subjects.find((item) => item.id === subjectId),
    [subjectId, subjects],
  );
  const topic = useMemo(() => {
    if (!subjectId) return undefined;
    return (topicsBySubject[subjectId] ?? []).find((item) => item.id === topicId);
  }, [subjectId, topicId, topicsBySubject]);

  if (!subjectId || !topicId) return <NotFoundPage />;
  if (subjects.length > 0 && !subject) return <NotFoundPage />;
  if (!topic && (topicsBySubject[subjectId]?.length ?? 0) > 0) return <NotFoundPage />;

  return (
    <TopicFlashcardsView
      subjectId={subjectId}
      topicId={topicId}
      subjectName={subject?.name}
      topicName={topic?.name}
      onBackToTopic={() => navigate(`/subjects/${subjectId}/topics/${topicId}`)}
    />
  );
}
