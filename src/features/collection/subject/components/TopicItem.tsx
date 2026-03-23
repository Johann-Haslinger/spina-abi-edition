import { IoChevronForward } from 'react-icons/io5';
import { Link } from 'react-router-dom';
import type { Topic } from '../../../../domain/models';

export function TopicItem(props: {
  subjectId: string;
  topic: Topic;
  from?: string;
  onStartSession: (topicId: string) => void;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
}) {
  const { subjectId, topic: t } = props;

  return (
    <Link to={`/subjects/${subjectId}/topics/${t.id}`} className="w-full h-fit pb-12 group">
      <div className="text-5xl flex items-center group-hover:scale-105 transition-all duration-300 justify-center h-40 bg-white/3 rounded-xl mb-2">
        {t.iconEmoji ? `${t.iconEmoji} ` : '📔'}{' '}
      </div>
      <div className="mt-4">
        <p className="text-lg font-semibold">{t.name}</p>
        <p className="text-sm mt-1 text-white/50">
          {t.description ?? 'lorem ipsum dolor sit amet lorem ipsum dolor sit amet'}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm ">
        <p className="group-hover:underline">Öffnen</p>
        <IoChevronForward />
      </div>
    </Link>
  );
}
