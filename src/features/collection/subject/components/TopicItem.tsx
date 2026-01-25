import { ArrowDown, ArrowUp, Pencil, Play, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Topic } from '../../../../domain/models'

export function TopicItem(props: {
  subjectId: string
  topic: Topic
  index: number
  total: number
  onStartSession: (topicId: string) => void
  onMove: (topicId: string, direction: 'up' | 'down') => void
  onEdit: (topic: Topic) => void
  onDelete: (topic: Topic) => void
}) {
  const { subjectId, topic: t, index, total, onStartSession, onMove, onEdit, onDelete } = props

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <Link
        to={`/subjects/${subjectId}/topics/${t.id}`}
        className="min-w-0 truncate text-sm font-semibold text-slate-50 hover:underline"
      >
        {t.iconEmoji ? `${t.iconEmoji} ` : ''}
        {t.name}
      </Link>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onStartSession(t.id)}
          className="rounded-md p-2 text-emerald-200 hover:bg-emerald-950/40"
          aria-label="Session starten"
          title="Session starten"
        >
          <Play className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(t.id, 'up')}
          disabled={index === 0}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50 disabled:opacity-30"
          aria-label="Nach oben"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(t.id, 'down')}
          disabled={index === total - 1}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50 disabled:opacity-30"
          aria-label="Nach unten"
        >
          <ArrowDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onEdit(t)}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
          aria-label="Bearbeiten"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(t)}
          className="rounded-md p-2 text-rose-200 hover:bg-rose-950/50"
          aria-label="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

