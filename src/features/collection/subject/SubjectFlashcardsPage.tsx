import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NotFoundPage } from '../../common/NotFoundPage';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { SubjectFlashcardsView } from './SubjectFlashcardsView';

export function SubjectFlashcardsPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { subjects, refresh: refreshSubjects } = useSubjectsStore();
  const { refreshBySubject } = useTopicsStore();

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

  if (!subjectId) return <NotFoundPage />;
  if (subjects.length > 0 && !subject) return <NotFoundPage />;

  return (
    <SubjectFlashcardsView
      subjectId={subjectId}
      subjectName={subject?.name}
      onBackToSubject={() => navigate(`/subjects/${subjectId}`)}
    />
  );
}
