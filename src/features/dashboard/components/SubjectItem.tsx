import { ArrowRight, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CollectionItemActionWrapper } from '../../../components/CollectionItemActionWrapper';
import type { Subject } from '../../../domain/models';
import { usePageSurfaceTheme } from '../../../ui/hooks/useSubjectColors';

export function SubjectItem(props: {
  subject: Subject;
  onEdit: (subject: Subject) => void;
  onDelete?: (subject: Subject) => void;
}) {
  const { subject: s, onEdit, onDelete } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundColor = usePageSurfaceTheme(s)?.pageBackground;

  const openSubject = () => {
    navigate(`/subjects/${s.id}`, {
      state: { from: location.pathname },
    });
  };

  return (
    <li className="list-none">
      <CollectionItemActionWrapper
        primaryAction={openSubject}
        actions={[
          {
            key: 'open',
            label: 'Öffnen',
            icon: <FolderOpen className="h-4 w-4" />,
            onSelect: openSubject,
          },
          {
            key: 'edit',
            label: 'Bearbeiten',
            icon: <Pencil className="h-4 w-4" />,
            onSelect: () => onEdit(s),
          },
          ...(onDelete
            ? [
                {
                  key: 'delete',
                  label: 'Löschen',
                  icon: <Trash2 className="h-4 w-4" />,
                  tone: 'danger' as const,
                  onSelect: () => onDelete(s),
                },
              ]
            : []),
        ]}
      >
        <div
          style={{
            backgroundColor: backgroundColor,
            color: '#FFFFFF',
          }}
          className="min-h-52 group hover:scale-105 transition-all duration-300 justify-around flex flex-col rounded-none p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="group flex min-w-0 flex-1 flex-col" aria-label={`Öffne Fach ${s.name}`}>
              <span className="truncate text-3xl font-semibold leading-tight text-inherit">
                {s.name}
              </span>
            </div>

            <div className="flex items-end gap-1">
              <button
                type="button"
                onClick={() => onEdit(s)}
                className="rounded-md p-2 invisible group-hover:visible text-current/85 hover:bg-black/10 hover:text-current"
                aria-label="Bearbeiten"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-auto flex items-end justify-end">
            <span
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors group-hover:bg-white/25"
            >
              <span className="sr-only">Öffnen</span>
              <ArrowRight className="size-6" aria-hidden />
            </span>
          </div>
        </div>
      </CollectionItemActionWrapper>
    </li>
  );
}
