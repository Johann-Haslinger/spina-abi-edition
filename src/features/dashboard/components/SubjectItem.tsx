import { ArrowRight, Pencil } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { Subject } from '../../../domain/models'
import { useSubjectGradient } from '../../../ui/hooks/useSubjectColors'

export function SubjectItem(props: {
  subject: Subject
  onEdit: (subject: Subject) => void
}) {
  const { subject: s, onEdit } = props
  const location = useLocation()
  const { topHex, bottomHex } = useSubjectGradient(s)

  return (
    <li
      style={{
        backgroundColor: bottomHex,
        color: topHex,
      }}
      className="min-h-28 rounded-none p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/subjects/${s.id}`}
          state={{ from: location.pathname }}
          className="group flex min-w-0 flex-1 flex-col"
          aria-label={`Öffne Fach ${s.name}`}
        >
          <div className="flex items-center gap-2">
            {s.iconEmoji ? (
              <span className="text-2xl leading-none" aria-hidden>
                {s.iconEmoji}
              </span>
            ) : null}
            <span
              className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: topHex }}
              aria-hidden
            />
            <span className="truncate text-xl font-semibold leading-tight text-inherit">
              {s.name}
            </span>
          </div>

          <div className="mt-auto flex items-end justify-end">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-current/90 transition-colors group-hover:bg-black/15">
              <span className="sr-only">Öffnen</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(s)}
            className="rounded-md p-2 text-current/85 hover:bg-black/10 hover:text-current"
            aria-label="Bearbeiten"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  )
}

