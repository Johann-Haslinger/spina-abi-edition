import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Subject } from '../../../domain/models'

export function SubjectItem(props: {
  subject: Subject
  onEdit: (subject: Subject) => void
  onDelete: (subject: Subject) => void
}) {
  const { subject: s, onEdit, onDelete } = props

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {s.iconEmoji ? (
              <span className="text-base leading-none" aria-hidden>
                {s.iconEmoji}
              </span>
            ) : null}
            <span
              className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <Link
              to={`/subjects/${s.id}`}
              className="truncate text-sm font-semibold text-slate-50 hover:underline"
            >
              {s.name}
            </Link>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Themen, Assets, Reviews kommen als nächstes.
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(s)}
            className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
            aria-label="Bearbeiten"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(s)}
            className="rounded-md p-2 text-rose-200 hover:bg-rose-950/50"
            aria-label="Löschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  )
}

