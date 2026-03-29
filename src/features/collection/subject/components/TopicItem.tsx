import { BookOpen, Pencil, Trash2 } from 'lucide-react';
import { IoChevronForward } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { CollectionItemActionWrapper } from '../../../../components/CollectionItemActionWrapper';
import type { Topic } from '../../../../domain/models';

export function TopicItem(props: {
  subjectId: string;
  topic: Topic;
  from?: string;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
}) {
  const { subjectId, topic: t } = props;
  const navigate = useNavigate();

  const openTopic = () => {
    navigate(`/subjects/${subjectId}/topics/${t.id}`, {
      state: props.from ? { from: props.from } : undefined,
    });
  };

  return (
    <li className="w-full list-none">
      <CollectionItemActionWrapper
        className="w-full"
        contentClassName="w-full h-fit pb-12 group"
        primaryAction={openTopic}
        actions={[
          {
            key: 'open',
            label: 'Öffnen',
            icon: <BookOpen className="h-4 w-4" />,
            onSelect: openTopic,
          },
          {
            key: 'edit',
            label: 'Bearbeiten',
            icon: <Pencil className="h-4 w-4" />,
            onSelect: () => props.onEdit(t),
          },
          {
            key: 'delete',
            label: 'Löschen',
            icon: <Trash2 className="h-4 w-4" />,
            tone: 'danger',
            onSelect: () => props.onDelete(t),
          },
        ]}
      >
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
      </CollectionItemActionWrapper>
    </li>
  );
}
