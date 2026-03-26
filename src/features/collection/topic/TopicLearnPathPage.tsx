import { useEffect, useMemo } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { ViewerIconButton } from '../../../components/ViewerIconButton';
import { useSubjectsStore } from '../../../stores/subjectsStore';
import { useTopicsStore } from '../../../stores/topicsStore';
import { NotFoundPage } from '../../common/NotFoundPage';
import { TopicKnowledgePathView } from './learnpath/TopicKnowledgePathView';

export function TopicLearnPathPage() {
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

  const subject = useMemo(() => subjects.find((item) => item.id === subjectId), [subjectId, subjects]);
  const topic = useMemo(() => {
    if (!subjectId) return undefined;
    return (topicsBySubject[subjectId] ?? []).find((item) => item.id === topicId);
  }, [subjectId, topicId, topicsBySubject]);

  if (!subjectId || !topicId) return <NotFoundPage />;
  if (subjects.length > 0 && !subject) return <NotFoundPage />;
  if (!topic && (topicsBySubject[subjectId]?.length ?? 0) > 0) return <NotFoundPage />;

  return (
    <div className="h-full pb-16">
      <ViewerIconButton
        ariaLabel="Zurück zum Thema"
        onClick={() => navigate(`/subjects/${subjectId}/topics/${topicId}`)}
        className="fixed left-8 top-18"
      >
        <IoChevronBack />
      </ViewerIconButton>
      <div className="px-16">
        <PageHeader
          title={topic ? `${topic.iconEmoji ? topic.iconEmoji + ' ' : ''}${topic.name} Wissenspfad` : 'Wissenspfad'}
        />
        <TopicKnowledgePathView topicId={topicId} topicName={topic?.name} subjectName={subject?.name} />
      </div>
    </div>
  );
}
