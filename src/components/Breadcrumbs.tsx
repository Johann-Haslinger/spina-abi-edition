import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type BreadcrumbItem = {
  label: ReactNode
  to?: string
  state?: unknown
}

export function Breadcrumbs(props: { items: Array<BreadcrumbItem | null | undefined> }) {
  const items: BreadcrumbItem[] = props.items.filter(
    (i): i is BreadcrumbItem => !!i && i.label !== null && i.label !== undefined,
  )
  if (items.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          const content =
            item.to && !isLast ? (
              <Link
                to={item.to}
                state={item.state}
                className="hover:text-slate-900 dark:hover:text-slate-200"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-900 dark:text-slate-200' : undefined}>
                {item.label}
              </span>
            )

          return (
            <li key={idx} className="inline-flex items-center">
              {idx > 0 ? <ChevronRight className="mx-1 h-4 w-4 opacity-70" /> : null}
              {content}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

